const cheerio = require('cheerio');

const FONT_FAMILY_MAP = {
  arial: "font-family: Arial, sans-serif;",
  timesnewroman: "font-family: 'Times New Roman', Times, serif;",
  helvetica: "font-family: Helvetica, Arial, sans-serif;",
  georgia: "font-family: Georgia, serif;",
  verdana: "font-family: Verdana, Geneva, sans-serif;",
  trebuchetms: "font-family: 'Trebuchet MS', Helvetica, sans-serif;",
  tahoma: "font-family: Tahoma, Geneva, sans-serif;",
  couriernew: "font-family: 'Courier New', Courier, monospace;",
  lucidasansunicode: "font-family: 'Lucida Sans Unicode', 'Lucida Grande', sans-serif;",
  palatinolinotype: "font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, serif;"
};

const FONT_SIZE_MAP = {
  small: 'font-size: 12px;',
  large: 'font-size: 18px;',
  huge: 'font-size: 26px;'
};

const ALIGNMENT_MAP = {
  center: 'text-align: center;',
  right: 'text-align: right;',
  justify: 'text-align: justify;'
};

const WRAPPER_STYLE = [
  "font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif",
  'font-size: 15px',
  'line-height: 1.6',
  'color: #111827',
  'word-break: break-word'
].join('; ');

const DEFAULT_PARAGRAPH_STYLE = 'margin: 0;';
const DEFAULT_LIST_MARGIN = 'margin: 0 0 0.85em 1.25em;';
const DEFAULT_LIST_PADDING = 'padding: 0 0 0 1.25em;';
const DEFAULT_LIST_ITEM_STYLE = 'margin: 0.35em 0;';

const isFormattingDisabled = process.env.DISABLE_RICH_EMAIL_HTML === 'true';
const isLoggingDisabled = process.env.DISABLE_EMAIL_HTML_LOG === 'true';
const LOG_PREVIEW_LENGTH = Number(process.env.EMAIL_HTML_LOG_PREVIEW || 2000);

const cssPropertyExists = (style, property) => {
  if (!style || !property) return false;
  const regex = new RegExp(`${property}\\s*:`, 'i');
  return regex.test(style);
};

const appendStyle = ($el, style) => {
  if (!$el || !style) return;
  const current = $el.attr('style');
  if (current && current.includes(style)) {
    return;
  }
  const normalized = current ? `${current.trim().replace(/;$/, '')}; ${style}` : style;
  $el.attr('style', normalized);
};

const ensureStyle = ($el, property, declaration) => {
  if (!$el || !property || !declaration) return;
  const current = $el.attr('style');
  if (cssPropertyExists(current, property)) {
    return;
  }
  appendStyle($el, declaration);
};

const applyQuillClass = ($el, className) => {
  if (!className) return false;

  if (className.startsWith('ql-font-')) {
    const key = className.replace('ql-font-', '');
    if (FONT_FAMILY_MAP[key]) {
      appendStyle($el, FONT_FAMILY_MAP[key]);
      return true;
    }
    return false;
  }

  if (className.startsWith('ql-size-')) {
    const key = className.replace('ql-size-', '');
    if (FONT_SIZE_MAP[key]) {
      appendStyle($el, FONT_SIZE_MAP[key]);
      return true;
    }
    return false;
  }

  if (className.startsWith('ql-align-')) {
    const key = className.replace('ql-align-', '');
    if (ALIGNMENT_MAP[key]) {
      appendStyle($el, ALIGNMENT_MAP[key]);
      return true;
    }
    return false;
  }

  if (className.startsWith('ql-indent-')) {
    const level = Number(className.replace('ql-indent-', '')) || 0;
    if (level > 0) {
      const padding = `padding-left: ${level * 1.5}em;`;
      appendStyle($el, padding);
      return true;
    }
    return false;
  }

  if (className === 'ql-direction-rtl') {
    appendStyle($el, 'direction: rtl; text-align: right;');
    return true;
  }

  if (className === 'ql-direction-ltr') {
    appendStyle($el, 'direction: ltr; text-align: left;');
    return true;
  }

  return false;
};

const formatEmailHtml = (inputHtml = '') => {
  if (isFormattingDisabled) {
    return inputHtml || '';
  }

  const html = inputHtml || '';
  const trimmed = html.trim();
  if (!trimmed) {
    return '';
  }

  const $ = cheerio.load(`<div id="__email-rich-root">${trimmed}</div>`, {
    decodeEntities: false
  });

  $('#__email-rich-root *').each((_, element) => {
    const $el = $(element);
    const classAttr = $el.attr('class');
    if (!classAttr) {
      return;
    }

    const classes = classAttr.split(/\s+/).filter(Boolean);
    if (classes.length === 0) {
      $el.removeAttr('class');
      return;
    }

    const classesToKeep = [];
    classes.forEach((cls) => {
      const handled = applyQuillClass($el, cls);
      if (!handled) {
        classesToKeep.push(cls);
      }
    });

    if (classesToKeep.length > 0) {
      $el.attr('class', classesToKeep.join(' '));
    } else {
      $el.removeAttr('class');
    }
  });

  $('#__email-rich-root p').each((_, element) => ensureStyle($(element), 'margin', DEFAULT_PARAGRAPH_STYLE));
  $('#__email-rich-root ul, #__email-rich-root ol').each((_, element) => ensureStyle($(element), 'margin', DEFAULT_LIST_MARGIN));
  $('#__email-rich-root ul, #__email-rich-root ol').each((_, element) => ensureStyle($(element), 'padding', DEFAULT_LIST_PADDING));
  $('#__email-rich-root li').each((_, element) => ensureStyle($(element), 'margin', DEFAULT_LIST_ITEM_STYLE));
  $('#__email-rich-root li').each((_, element) => ensureStyle($(element), 'line-height', 'line-height: 1.6;'));

  let formatted = $('#__email-rich-root').html();
  if (!formatted) {
    return '';
  }

  if (!/data-rich-email-wrapper/.test(formatted)) {
    formatted = `<div data-rich-email-wrapper="true" style="${WRAPPER_STYLE}">${formatted}</div>`;
  }

  return formatted;
};

const logEmailHtmlPayload = (context, html) => {
  if (isLoggingDisabled) {
    return;
  }

  const safeContext = context || 'email';
  const payload = html || '';
  const previewLimit = Number.isFinite(LOG_PREVIEW_LENGTH) ? LOG_PREVIEW_LENGTH : 2000;
  const preview = payload.length > previewLimit ? `${payload.slice(0, previewLimit)} …(truncated)` : payload;

  console.log(`📄 [EmailHtml:${safeContext}] length=${payload.length}`);
  if (preview) {
    console.log(preview);
  }
};

module.exports = {
  formatEmailHtml,
  logEmailHtmlPayload
};

