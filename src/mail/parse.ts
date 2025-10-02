import type { ForwardableEmailMessage, ReadableStream, ReadableWritablePair } from "@cloudflare/workers-types";
import type { RawEmail } from "postal-mime";
import type { EmailCache, MaxEmailSizePolicy } from "../types";
import { convert } from "html-to-text";
import PostalMime from "postal-mime";

function truncateStream(stream: ReadableStream<Uint8Array>, maxBytes: number): ReadableStream<Uint8Array> {
  let bytesRead = 0;
  const tran = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk: Uint8Array, controller: TransformStreamDefaultController<Uint8Array>) {
      if (bytesRead >= maxBytes) {
        controller.terminate();
        return;
      }
      const remainingBytes = maxBytes - bytesRead;
      if (chunk.length <= remainingBytes) {
        controller.enqueue(chunk);
        bytesRead += chunk.length;
      } else {
        const limitedChunk = chunk.slice(0, remainingBytes);
        controller.enqueue(limitedChunk);
        bytesRead += remainingBytes;
        controller.terminate();
      }
    },
  }) as ReadableWritablePair<Uint8Array, Uint8Array>;
  return stream.pipeThrough(tran);
}

export async function parseEmail(message: ForwardableEmailMessage, maxSize: number, maxSizePolicy: MaxEmailSizePolicy, useEmlHeaders: boolean = false): Promise<EmailCache> {
  const id = crypto.randomUUID();
  const cache: EmailCache = {
    id,
    messageId: message.headers.get("Message-ID") || id,
    from: message.from,
    to: message.to,
    subject: message.headers.get("Subject") || "",
    receivedAt: Date.now(),
  };
  let isTruncate = false;
  let emailRaw = message.raw;
  try {
    switch (message.rawSize > maxSize ? maxSizePolicy : "continue") {
      case "unhandled":
        cache.text = `The original size of the email was ${message.rawSize} bytes, which exceeds the maximum size of ${maxSize} bytes.`;
        cache.html = cache.text;
        return cache;
      case "truncate":
        isTruncate = true;
        emailRaw = truncateStream(message.raw, maxSize);
        break;
      default:
        break;
    }
    const parser = new PostalMime();
    const email = await parser.parse(emailRaw as RawEmail);
    if (useEmlHeaders) {
      cache.messageId = email.messageId;
      cache.subject = email.subject || cache.subject;
      cache.from = email.from.address || cache.from;
      cache.to = email.to?.map((addr) => addr.address).at(0) || cache.to;
    }
    cache.html = email.html;
    cache.text = email.text;
    if (cache.html && !cache.text) {
      cache.text = convert(cache.html, {});
    }
    if (isTruncate) {
      cache.text += `\n\n[Truncated] The original size of the email was ${message.rawSize} bytes, which exceeds the maximum size of ${maxSize} bytes.`;
    }
  } catch (e) {
    const msg = `Error parsing email: ${(e as Error).message}`;
    cache.text = msg;
    cache.html = msg;
  }
  return cache;
}
