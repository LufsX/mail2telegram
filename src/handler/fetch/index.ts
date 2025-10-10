import type { IRequest, RouterType } from "itty-router";
import type { AddressListStoreKey } from "../../db";
import type { Environment } from "../../types";
import { validate } from "@tma.js/init-data-node/web";
import { json, Router } from "itty-router";
import { Dao } from "../../db";
import { getMailSummary } from "../../mail";
import { createTelegramBotAPI, telegramCommands, telegramWebhookHandler, tmaHTML } from "../../telegram";
import { buildHtmlFallbackFromText, buildHtmlPreview, buildMailMetadata, buildPlainPreview, stripHtmlTags } from "./templates";

class HTTPError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function createTmaAuthMiddleware(env: Environment): (req: Request) => Promise<void> {
  const { TELEGRAM_TOKEN, TELEGRAM_ID } = env;
  return async (req: Request): Promise<void> => {
    const [authType, authData = ""] = (req.headers.get("Authorization") || "").split(" ");
    if (authType !== "tma") {
      throw new HTTPError(401, "Invalid authorization type");
    }
    try {
      await validate(authData, TELEGRAM_TOKEN, {
        expiresIn: 3600,
      });
      const user = JSON.parse(new URLSearchParams(authData).get("user") || "{}");
      for (const id of TELEGRAM_ID.split(",")) {
        if (id === `${user.id}`) {
          return;
        }
      }
      throw new HTTPError(403, "Permission denied");
    } catch (e) {
      throw new HTTPError(401, (e as Error).message);
    }
  };
}

type AddressType = "block" | "white";

function addressParamsCheck(address: string, type: AddressType): AddressListStoreKey {
  const keyMap: { [key in AddressType]: AddressListStoreKey } = {
    block: "BLOCK_LIST",
    white: "WHITE_LIST",
  };
  if (!address || !type) {
    throw new HTTPError(400, "Missing address or type");
  }
  if (keyMap[type] === undefined) {
    throw new HTTPError(400, "Invalid type");
  }
  return keyMap[type];
}

function errorHandler(error: Error): Response {
  if (error instanceof HTTPError) {
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      { status: error.status }
    );
  }
  return new Response(
    JSON.stringify({
      error: error.message,
    }),
    { status: 500 }
  );
}

function createRouter(env: Environment): RouterType {
  const router = Router({
    catch: errorHandler,
    finally: [json],
  });

  const { TELEGRAM_TOKEN, DOMAIN, DB } = env;
  const dao = new Dao(DB);
  const auth = createTmaAuthMiddleware(env);

  router.get("/", async (): Promise<Response> => {
    return new Response(null, {
      status: 302,
      headers: {
        location: "https://github.com/TBXark/mail2telegram",
      },
    });
  });

  router.get("/init", async (): Promise<any> => {
    const api = createTelegramBotAPI(TELEGRAM_TOKEN);
    const webhook = await api.setWebhook({
      url: `https://${DOMAIN}/telegram/${TELEGRAM_TOKEN}/webhook`,
    });
    const commands = await api.setMyCommands({
      commands: telegramCommands,
    });
    return {
      webhook: await webhook.json(),
      commands: await commands.json(),
    };
  });

  /// Telegram Mini Apps

  router.get("/tma", async (): Promise<Response> => {
    return new Response(tmaHTML, {
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
  });

  router.post("/api/address/add", auth, async (req: IRequest): Promise<any> => {
    const { address, type } = (await req.json()) as { address: string; type: AddressType };
    const key = addressParamsCheck(address, type);
    await dao.addAddress(address, key);
    return { success: true };
  });

  router.post("/api/address/remove", auth, async (req: IRequest): Promise<any> => {
    const { address, type } = (await req.json()) as { address: string; type: AddressType };
    const key = addressParamsCheck(address, type);
    await dao.removeAddress(address, key);
    return { success: true };
  });

  router.get("/api/address/list", auth, async (): Promise<any> => {
    const block = await dao.loadArrayFromDB("BLOCK_LIST");
    const white = await dao.loadArrayFromDB("WHITE_LIST");
    return { block, white };
  });

  router.get("/api/mails/list", auth, async (req: IRequest): Promise<any> => {
    const limit = Number.parseInt((req.query?.limit as string) || "50", 10);
    const cursor = req.query?.cursor as string | undefined;
    return await dao.listMails(limit, cursor);
  });

  router.get("/api/mails/:id", auth, async (req: IRequest): Promise<any> => {
    const id = req.params.id;
    const mail = await dao.loadMailCache(id);
    if (!mail) {
      throw new HTTPError(404, "Email not found");
    }
    return mail;
  });

  router.get("/api/mails/:id/summary", auth, async (req: IRequest): Promise<any> => {
    const id = req.params.id;
    const mail = await dao.loadMailCache(id);
    if (!mail) {
      throw new HTTPError(404, "Email not found");
    }
    return await getMailSummary(mail, env);
  });

  router.post("/api/summary/clear", auth, async (): Promise<any> => {
    const deleted = await dao.clearMailSummaries();
    return { success: true, deleted };
  });

  router.delete("/api/mails/:id", auth, async (req: IRequest): Promise<any> => {
    const id = req.params.id;
    await dao.deleteMail(id);
    return { success: true };
  });

  router.post("/api/mails/:id/summary/refresh", auth, async (req: IRequest): Promise<any> => {
    const id = req.params.id;
    const mail = await dao.loadMailCache(id);
    if (!mail) {
      throw new HTTPError(404, "Email not found");
    }
    await dao.deleteMailSummary(id);
    return await getMailSummary(mail, env);
  });

  /// Webhook

  router.post("/telegram/:token/webhook", async (req: IRequest): Promise<any> => {
    if (req.params.token !== TELEGRAM_TOKEN) {
      throw new HTTPError(403, "Invalid token");
    }
    try {
      await telegramWebhookHandler(req, env);
    } catch (e) {
      console.error(e);
    }
    return { success: true };
  });

  /// Preview

  router.get("/email/:id", async (req: IRequest): Promise<Response> => {
    const id = req.params.id;
    const mode = (req.query?.mode as string | undefined)?.toLowerCase() ?? "text";
    const value = await dao.loadMailCache(id);

    if (!value) {
      throw new HTTPError(404, "Email not found");
    }

    const metadata = buildMailMetadata(value);

    if (mode === "html") {
      const html = buildHtmlPreview(metadata, value.html ?? buildHtmlFallbackFromText(value.text ?? ""));
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    const plainTextBody = value.text ?? stripHtmlTags(value.html ?? "");
    const text = buildPlainPreview(metadata, plainTextBody);
    return new Response(text, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  });

  router.all("*", async () => {
    throw new HTTPError(404, "Not found");
  });

  return router;
}

export async function fetchHandler(request: Request, env: Environment): Promise<Response> {
  const router = createRouter(env);
  return router.fetch(request).catch((e) => {
    return new Response(
      JSON.stringify({
        error: e.message,
      }),
      { status: 500 }
    );
  });
}
