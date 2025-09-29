interface MailAddressInfo {
  name: string;
  email: string;
}

export interface MailPreviewMetadata {
  fromEmail: string;
  toEmail: string;
  subject: string;
}

export function buildMailMetadata(value: { from: string; to: string; subject: string }): MailPreviewMetadata {
  const fromInfo = parseMailAddress(value.from);
  const toInfo = parseMailAddress(value.to);
  return {
    fromEmail: fromInfo.email,
    toEmail: toInfo.email,
    subject: value.subject || "",
  };
}

export function buildPlainPreview(metadata: MailPreviewMetadata, body: string): string {
  const lines: string[] = [`发件邮箱: ${metadata.fromEmail || "-"}`, `收件邮箱: ${metadata.toEmail || "-"}`, "", `标题: ${metadata.subject || "(无标题)"}`, "", "正文:", "", body || "(正文为空)"];
  return lines.join("\n");
}

export function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, "").trimEnd();
}

export function buildHtmlFallbackFromText(text: string): string {
  if (!text) {
    return '<p class="empty">(正文为空)</p>';
  }
  return `<pre class="plain-text-body">${escapeHtml(text)}</pre>`;
}

export function buildHtmlPreview(metadata: MailPreviewMetadata, bodyHtml: string): string {
  const subjectTitle = metadata.subject || "邮件预览";
  const iframeContent = escapeAttribute(bodyHtml);
  const fromEmail = escapeHtml(metadata.fromEmail || "-");
  const toEmail = escapeHtml(metadata.toEmail || "-");
  const safeSubject = escapeHtml(subjectTitle);
  const metaSubject = escapeAttribute(subjectTitle);

  return `<!DOCTYPE html>
<html lang="zh-cn">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-mail-subject" content="${metaSubject}" />
  <title>${safeSubject}</title>
  <style>
    :root {
      color-scheme: light dark;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 32px 16px;
      background: #f5f7fa;
      color: #1f2933;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
      background: #ffffff;
      padding: 32px 28px 0;
      border-radius: 16px;
      box-shadow: 0 20px 45px rgba(15, 23, 42, 0.15);
      overflow: hidden;
    }
    .meta-stack {
      display: flex;
      flex-direction: column;
      border-radius: 12px;
      border: 1px solid rgba(226, 232, 240, 0.8);
      background: rgba(248, 250, 252, 0.55);
      overflow: hidden;
    }
    .meta-row {
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .meta-row + .meta-row {
      border-top: 1px solid rgba(226, 232, 240, 0.8);
    }
    .label {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #94a3b8;
    }
    .value {
      font-size: 0.95rem;
      font-weight: 500;
      color: #475569;
      word-break: break-all;
    }
    h1.subject {
      margin: 36px auto 16px;
      font-size: 1.5rem;
      font-weight: 600;
      text-align: center;
      color: #0f172a;
      line-height: 1.35;
      word-break: break-word;
    }
    .divider-with-button {
      position: relative;
      margin: 0 0 32px;
    }
    hr.subject-divider {
      width: 100%;
      margin: 0;
      border: none;
      border-top: 1px solid #e2e8f0;
    }
    button#download-btn {
      position: absolute;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      padding: 6px 14px;
      border-radius: 9999px;
      border: none;
      background: #3b82f6;
      color: #fff;
      font-size: 0.85rem;
      cursor: pointer;
      box-shadow: 0 10px 24px rgba(59, 130, 246, 0.25);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    button#download-btn:hover {
      transform: translateY(-50%) scale(1.02);
      box-shadow: 0 14px 32px rgba(59, 130, 246, 0.35);
    }
    button#download-btn:active {
      transform: translateY(-50%) scale(0.98);
    }
    .content-wrapper {
      display: flex;
      justify-content: center;
      overflow-x: auto;
  margin: 0 -28px 0;
  padding-bottom: 0;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .content-wrapper::-webkit-scrollbar {
      display: none;
    }
    iframe#mail-frame {
      width: 100%;
      border: none;
      border-radius: 0 0 16px 16px;
      background: transparent;
      display: block;
      margin: 0;
      overflow: auto;
    }
    .plain-text-body {
      white-space: pre-wrap;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 0.95rem;
      line-height: 1.6;
      margin: 0;
      padding: 24px;
      background: #f8fafc;
      min-height: 100%;
    }
    .empty {
      color: #94a3b8;
      font-style: italic;
      padding: 24px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <section class="meta-stack">
      <div class="meta-row">
        <span class="label">发件邮箱</span>
        <span class="value">${fromEmail}</span>
      </div>
      <div class="meta-row">
        <span class="label">收件邮箱</span>
        <span class="value">${toEmail}</span>
      </div>
    </section>
    <h1 class="subject">${safeSubject}</h1>
    <div class="divider-with-button" data-download-exclude="true">
      <hr class="subject-divider" />
      <button id="download-btn" type="button">下载 HTML</button>
    </div>
    <div class="content-wrapper">
      <iframe id="mail-frame" title="邮件正文预览" srcdoc="${iframeContent}"></iframe>
    </div>
  </div>
  <script data-download-exclude="true">
    (function () {
      function syncIframeHeight(frame) {
        if (!frame) {
          return;
        }
        var doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
        if (!doc) {
          return;
        }
        var body = doc.body;
        var html = doc.documentElement;
        var height = 0;
        if (body) {
          height = Math.max(height, body.scrollHeight, body.offsetHeight);
        }
        if (html) {
          height = Math.max(height, html.scrollHeight, html.offsetHeight);
        }
        if (height) {
          frame.style.height = height + "px";
        }
      }

      var frame = document.getElementById('mail-frame');
      if (frame) {
        frame.addEventListener('load', function () {
          syncIframeHeight(frame);
          try {
            if ('ResizeObserver' in window) {
              var observer = new ResizeObserver(function () {
                syncIframeHeight(frame);
              });
              var target = frame.contentDocument && frame.contentDocument.body;
              if (target) {
                observer.observe(target);
              }
            } else {
              var win = frame.contentWindow;
              if (win) {
                win.addEventListener('resize', function () {
                  syncIframeHeight(frame);
                });
              }
              setTimeout(function () {
                syncIframeHeight(frame);
              }, 500);
            }
          } catch (err) {
            setTimeout(function () {
              syncIframeHeight(frame);
            }, 300);
          }
        });
      }

      var btn = document.getElementById('download-btn');
      if (btn) {
        btn.addEventListener('click', function () {
          var clone = document.documentElement.cloneNode(true);
          clone.querySelectorAll('[data-download-exclude="true"]').forEach(function (el) {
            el.remove();
          });
          clone.querySelectorAll('script').forEach(function (el) {
            el.remove();
          });
          var serialized = '<!DOCTYPE html>' + new XMLSerializer().serializeToString(clone);
          var blob = new Blob([serialized], { type: 'text/html' });
          var url = URL.createObjectURL(blob);
          var link = document.createElement('a');
          var meta = document.head.querySelector('meta[name="x-mail-subject"]');
          var subject = (meta && meta.getAttribute('content')) || 'email-preview';
          var filename = (subject || 'email-preview').replace(/[\\s/:"*?<>|]+/g, '-').slice(0, 80) || 'email-preview';
          link.href = url;
          link.download = filename + '.html';
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(function () {
            URL.revokeObjectURL(url);
          }, 2000);
        });
      }
    })();
  </script>
</body>
</html>`;
}

function parseMailAddress(address?: string | null): MailAddressInfo {
  if (!address) {
    return { name: "", email: "" };
  }
  const [first] = address.split(",");
  const trimmed = first.trim();
  const start = trimmed.lastIndexOf("<");
  const end = trimmed.lastIndexOf(">");
  if (start !== -1 && end !== -1 && end > start) {
    const name = trimmed.slice(0, start).replace(/^"|"$/g, "").trim();
    const email = trimmed.slice(start + 1, end).trim();
    return {
      name: name || email,
      email,
    };
  }
  if (trimmed.includes("@")) {
    return { name: trimmed, email: trimmed };
  }
  return { name: trimmed, email: "" };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/\n/g, "&#10;").replace(/\r/g, "&#13;");
}
