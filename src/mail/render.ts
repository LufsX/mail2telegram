import type * as Telegram from "telegram-bot-api-types";
import type { EmailCache, Environment } from "../types";
import { Dao } from "../db";
import { checkAddressStatus } from "./check";
import { sendOpenAIRequest } from "./openai";

export interface MailSummaryResult {
  text: string;
  source: "cache" | "generated" | "unavailable" | "error";
}

export interface EmailDetailParams {
  text: string;
  reply_markup: Telegram.InlineKeyboardMarkup;
  link_preview_options: Telegram.LinkPreviewOptions;
  parse_mode?: Telegram.ParseMode;
}

function escapeMarkdownV2(text: string): string {
  // eslint-disable-next-line no-useless-escape
  const specials = new Set(["_", "*", "[", "]", "(", ")", "~", "`", ">", "#", "+", "-", "=", "|", "{", "}", ".", "!"]);
  let result = "";
  for (const char of text) {
    if (char === "\\") {
      result += "\\\\";
    } else if (specials.has(char)) {
      result += `\\${char}`;
    } else {
      result += char;
    }
  }
  return result;
}

export type EmailRender = (mail: EmailCache, env: Environment) => Promise<EmailDetailParams>;

export async function renderEmailListMode(mail: EmailCache, env: Environment): Promise<EmailDetailParams> {
  const { DEBUG, OPENAI_API_KEY, DOMAIN } = env;
  const subject = mail.subject && mail.subject.length > 0 ? mail.subject : "无标题";
  const text = `*${escapeMarkdownV2(subject)}*\n\n────────────\nFrom: \`${escapeMarkdownV2(mail.from)}\`\nTo: \`${escapeMarkdownV2(mail.to)}\``;
  const keyboard: Telegram.InlineKeyboardButton[] = [
    {
      text: "显示正文",
      callback_data: `p:${mail.id}`,
    },
  ];
  if (OPENAI_API_KEY) {
    keyboard.push({
      text: "AI 摘要",
      callback_data: `s:${mail.id}`,
    });
  }
  if (mail.text) {
    keyboard.push({
      text: "文本预览",
      url: `https://${DOMAIN}/email/${mail.id}?mode=text`,
    });
  }
  if (mail.html) {
    keyboard.push({
      text: "HTML 预览",
      url: `https://${DOMAIN}/email/${mail.id}?mode=html`,
    });
  }
  if (DEBUG === "true") {
    keyboard.push({
      text: "Debug",
      callback_data: `d:${mail.id}`,
    });
  }
  return {
    text,
    reply_markup: {
      inline_keyboard: [keyboard],
    },
    link_preview_options: {
      is_disabled: true,
    },
    parse_mode: "MarkdownV2",
  };
}

function renderEmailDetail(text: string | undefined | null, id: string, parseMode?: Telegram.ParseMode): EmailDetailParams {
  return {
    text: text || "无正文内容",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "返回",
            callback_data: `l:${id}`,
          },
          {
            text: "删除",
            callback_data: `delete:${id}`,
          },
        ],
      ],
    },
    link_preview_options: {
      is_disabled: true,
    },
    parse_mode: parseMode,
  };
}

// eslint-disable-next-line unused-imports/no-unused-vars
export async function renderEmailPreviewMode(mail: EmailCache, env: Environment): Promise<EmailDetailParams> {
  const subject = mail.subject && mail.subject.length > 0 ? mail.subject : "无标题";
  const content = mail.text?.substring(0, 4096);
  const escapedSubject = `*${escapeMarkdownV2(subject)}*`;
  const escapedContent = content ? escapeMarkdownV2(content) : undefined;
  const text = escapedContent ? `${escapedSubject}\n\n${escapedContent}` : escapedSubject;
  return renderEmailDetail(text, mail.id, "MarkdownV2");
}

export async function renderEmailSummaryMode(mail: EmailCache, env: Environment): Promise<EmailDetailParams> {
  const req = renderEmailDetail("", mail.id);
  const summary = await getMailSummary(mail, env);
  req.text = summary.text;
  return req;
}

const htmlTagRegex = /<[^>]+>/g;

function extractMailContent(mail: EmailCache): string {
  if (mail.text && mail.text.trim().length > 0) {
    return mail.text;
  }
  if (mail.html && mail.html.trim().length > 0) {
    return mail.html.replace(htmlTagRegex, " ");
  }
  return "";
}

export async function getMailSummary(mail: EmailCache, env: Environment): Promise<MailSummaryResult> {
  const { OPENAI_API_KEY: key, OPENAI_COMPLETIONS_API: endpointRaw, OPENAI_CHAT_MODEL: modelRaw, SUMMARY_TARGET_LANG: targetLangRaw, MAIL_TTL: mailTtlRaw, DB } = env;
  const endpoint = endpointRaw || "https://api.openai.com/v1/chat/completions";
  const model = modelRaw || "gpt-4o-mini";
  const targetLang = (targetLangRaw || "english").trim();
  const cacheLang = targetLang.toLowerCase();
  const ttl = Number.parseInt(mailTtlRaw || "", 10) || 60 * 60 * 24;
  const dao = new Dao(DB);

  try {
    const cachedSummary = await dao.loadMailSummary(mail.id, cacheLang);
    if (cachedSummary) {
      return {
        text: cachedSummary,
        source: "cache",
      };
    }

    const content = extractMailContent(mail);
    if (!key) {
      return {
        text: "AI 摘要功能未启用",
        source: "unavailable",
      };
    }

    if (!content) {
      return {
        text: "无可摘要内容",
        source: "unavailable",
      };
    }

    const prompt = `使用七十个词以内的简洁语言，保留关键信息，用 ${targetLang} 语言，链接不算进字数，总结内容可以分行显示，若无实际内容可以总结，返回简短后的原文，邮件内容如下\n\n${content}`;
    const summary = (await sendOpenAIRequest(key, endpoint, model, prompt)).trim();

    if (summary) {
      await dao.saveMailSummary(mail.id, cacheLang, summary, ttl);
      return {
        text: summary,
        source: "generated",
      };
    }

    return {
      text: "AI 摘要生成失败",
      source: "error",
    };
  } catch (e) {
    console.error(e);
    return {
      text: "AI 摘要生成失败",
      source: "error",
    };
  }
}

export async function renderEmailDebugMode(mail: EmailCache, env: Environment): Promise<EmailDetailParams> {
  const addresses = [mail.from, mail.to];
  const res = await checkAddressStatus(addresses, env);
  const obj = {
    ...mail,
    block: res,
  };
  delete obj.html;
  delete obj.text;
  const text = JSON.stringify(obj, null, 2);
  return renderEmailDetail(text, mail.id);
}
