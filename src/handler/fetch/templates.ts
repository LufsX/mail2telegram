interface MailAddressInfo {
  name: string;
  email: string;
}

export interface MailPreviewMetadata {
  fromEmail: string;
  toEmail: string;
  subject: string;
  receivedAt?: number;
}

export function buildMailMetadata({ from, to, subject, receivedAt }: { from: string; to: string; subject: string; receivedAt?: number }): MailPreviewMetadata {
  const fromInfo = parseMailAddress(from);
  const toInfo = parseMailAddress(to);
  return {
    fromEmail: fromInfo.email,
    toEmail: toInfo.email,
    subject: subject ?? "",
    receivedAt,
  };
}

export function buildPlainPreview(metadata: MailPreviewMetadata, body: string): string {
  const lines: string[] = [
    `发件邮箱: ${metadata.fromEmail || "-"}`,
    `收件邮箱: ${metadata.toEmail || "-"}`,
    `收件时间: ${formatFullDateTime(metadata.receivedAt)}`,
    "",
    `标题: ${metadata.subject || "(无标题)"}`,
    "",
    "正文:",
    "",
    body || "(正文为空)",
  ];
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
  const receivedAtAttr = metadata.receivedAt == null ? "" : escapeAttribute(String(metadata.receivedAt));
  const safeSubject = escapeHtml(subjectTitle);
  const metaSubject = escapeAttribute(subjectTitle);

  return `<!DOCTYPE html>
<html lang="zh-cn" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-mail-subject" content="${metaSubject}" />
  <title>${safeSubject}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #fafafa;
      --surface: #ffffff;
      --surface-secondary: #f5f5f5;
      --text: #222;
      --text-strong: #111;
      --text-subtle: #333;
      --text-muted: #666;
      --text-faint: #999;
      --border: #e5e5e5;
      --border-soft: #f5f5f5;
      --primary: #0088cc;
      --primary-hover: #006699;
      --primary-text: #ffffff;
      --button-bg: #ffffff;
      --button-border: #ddd;
      --button-hover-border: #999;
      --button-hover-bg: #f9f9f9;
      --button-active-bg: #f0f0f0;
      --plain-bg: #fafafa;
      --plain-text: #333;
      --empty-text: #999;
      --frame-bg: #fff;
    }

    :root[data-theme="dark"] {
      color-scheme: dark;
      --bg: #000;
      --surface: #000;
      --surface-secondary: #1e293b;
      --text: #e2e8f0;
      --text-strong: #f8fafc;
      --text-subtle: #e2e8f0;
      --text-muted: #94a3b8;
      --text-faint: #94a3b8;
      --border: #1f2937;
      --border-soft: #24324a;
      --primary: #2bb8ff;
      --primary-hover: #5ecbff;
      --primary-text: #041322;
      --button-bg: #1f2937;
      --button-border: #334155;
      --button-hover-border: #60a5fa;
      --button-hover-bg: #273449;
      --button-active-bg: #334155;
      --plain-bg: #0f172a;
      --plain-text: #e2e8f0;
      --empty-text: #94a3b8;
      --frame-bg: #0f172a;
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      margin: 0;
      padding: 24px 16px;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      transition: background 0.2s ease, color 0.2s ease;
    }
    .container {
      max-width: 840px;
      margin: 0 auto;
      background: var(--surface);
      padding: 32px;
      border: 1px solid var(--border);
      overflow: hidden;
      transition: background 0.2s ease, border-color 0.2s ease;
    }
    .meta-stack {
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      margin-bottom: 40px;
    }
    .meta-row {
      padding: 14px 0;
      display: grid;
      grid-template-columns: 80px 1fr;
      align-items: baseline;
      border-bottom: 1px solid var(--border-soft);
    }
    .meta-row:last-child {
      border-bottom: none;
    }
    .label {
      font-size: 0.8125rem;
      color: var(--text-muted);
      font-weight: 500;
    }
    .value {
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
      font-size: 0.875rem;
      color: var(--text-subtle);
      word-break: break-all;
      letter-spacing: -0.01em;
    }
    h1.subject {
      margin: 0 0 40px;
      font-size: 1.625rem;
      font-weight: 600;
      color: var(--text-strong);
      line-height: 1.4;
      word-break: break-word;
      letter-spacing: -0.02em;
    }
    .divider-with-button {
      position: relative;
      margin-bottom: 24px;
    }
    hr.subject-divider {
      border: none;
      border-top: 1px solid var(--border);
      margin: 0;
    }
    button#download-btn {
      position: absolute;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      padding: 6px 16px;
      border: 1px solid var(--button-border);
      background: var(--button-bg);
      color: var(--text-subtle);
      font-size: 0.875rem;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s ease, color 0.2s ease;
    }
    button#download-btn:hover {
      border-color: var(--button-hover-border);
      background: var(--button-hover-bg);
    }
    button#download-btn:active {
      background: var(--button-active-bg);
    }
    .content-wrapper {
      margin: 0 -32px 0;
      padding-bottom: 0;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .content-wrapper::-webkit-scrollbar {
      display: none;
    }
    iframe#mail-frame {
      width: 100%;
      border: none;
      background: var(--frame-bg);
      display: block;
    }
    .plain-text-body {
      white-space: pre-wrap;
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
      font-size: 0.875rem;
      line-height: 1.7;
      margin: 0;
      padding: 24px 32px;
      color: var(--plain-text);
      background: var(--plain-bg);
    }
    .empty {
      color: var(--empty-text);
      font-style: italic;
      padding: 24px 32px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <section class="meta-stack">
      <div class="meta-row">
        <span class="label">发件邮箱:</span>
        <span class="value">${fromEmail}</span>
      </div>
      <div class="meta-row">
        <span class="label">收件邮箱:</span>
        <span class="value">${toEmail}</span>
      </div>
      <div class="meta-row">
        <span class="label">收件时间:</span>
        <span class="value" id="received-time" data-timestamp="${receivedAtAttr}">-</span>
      </div>
    </section>
    <h1 class="subject">${safeSubject}</h1>
    <div class="divider-with-button">
      <hr class="subject-divider" />
      <button id="download-btn" type="button" data-download-exclude="true">下载 HTML</button>
    </div>
    <div class="content-wrapper">
      <iframe id="mail-frame" title="邮件正文预览" srcdoc="<style>body{margin:0;padding:0;}</style>${iframeContent}"></iframe>
    </div>
  </div>
  <script data-download-exclude="true">
    (function () {
      function setTheme(scheme) {
        document.documentElement.setAttribute("data-theme", scheme === "dark" ? "dark" : "light");
      }

      function initTheme() {
        var tg = window.Telegram && window.Telegram.WebApp;

        if (tg && typeof tg.colorScheme === "string") {
          setTheme(tg.colorScheme);
          if (typeof tg.onEvent === "function") {
            tg.onEvent("themeChanged", function () {
              setTheme(tg.colorScheme);
            });
          }
        } else {
          var media = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
          if (media) {
            var apply = function (value) {
              setTheme(value ? "dark" : "light");
            };
            apply(media.matches);
            var handler = function (event) {
              apply(event.matches);
            };
            if (typeof media.addEventListener === "function") {
              media.addEventListener("change", handler);
            } else if (typeof media.addListener === "function") {
              media.addListener(handler);
            }
          }
        }
      }

      initTheme();

      var receivedTimeEl = document.getElementById('received-time');
      if (receivedTimeEl) {
        var timestamp = Number(receivedTimeEl.dataset.timestamp);
        if (Number.isFinite(timestamp) && timestamp > 0) {
          var date = new Date(timestamp);
          if (!Number.isNaN(date.getTime())) {
            receivedTimeEl.textContent = date.toLocaleString(undefined, {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            });
          }
        }
      }

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

function formatFullDateTime(timestamp?: number): string {
  if (timestamp == null) {
    return "-";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, " UTC");
}
