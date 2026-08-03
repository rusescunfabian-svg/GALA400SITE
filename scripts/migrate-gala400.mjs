#!/usr/bin/env node
/**
 * Gala 400 — migrate OLD site pages to V2 design.
 * Run from gala400-site: node scripts/migrate-gala400.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEW_ROOT = path.resolve(__dirname, '..');
const OLD_ROOT = path.resolve(NEW_ROOT, '..', '..', 'GALA400SITE');
const OLD_REF = path.resolve(NEW_ROOT, '..', 'GALA400SITE-old-ref');
const GITHUB_OLD = 'https://raw.githubusercontent.com/rfdigitall/GALA400SITE/3d55dd8';
const TEMPLATE = path.join(NEW_ROOT, 'servizi', 'pronto-intervento-idraulico-verona.html');
const SEO_ONLY_STYLE = `<style>.seo-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}</style>`;
const PHONE = '+393494208551';
const PHONE_DISPLAY = '349 420 8551';
const LASTMOD = '2026-07-12';

const JUNK_PROSE_RE = /^(richiamata immediata|domande frequenti|zone vicine|servizi idraulici|assistenza caldaie|altre marche|elenco servizi|contatti|informazioni)$/i;
const TRUST_LINE_RE = /^(chiami il numero|preventivo prima|tecnico in zona|intervento e collaudo|linea diretta|emergenza ora|gala 400)/i;
const BROKEN_HTML_RE = /<\/(h[1-6]|svg|span|article|section|div)/i;
const CALDAIA_ICO = `<svg class="sc2-ico" viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="12" y="8" width="20" height="24" rx="2"/><path d="M16 16h12M16 22h12M16 28h8"/><circle cx="32" cy="12" r="3"/></svg>`;

const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@800&family=Inter:wght@400;600;700&display=swap';
const FONTS_HEAD = `  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="${FONTS_URL}" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="${FONTS_URL}"></noscript>`;

const COOKIE_CSS_URL = 'https://cdn.jsdelivr.net/gh/orestbida/cookieconsent@3.0.1/dist/cookieconsent.css';
const COOKIE_JS_URL = 'https://cdn.jsdelivr.net/gh/orestbida/cookieconsent@3.0.1/dist/cookieconsent.umd.js';

const COOKIE_CONSENT_HEAD = `  <link rel="dns-prefetch" href="https://cdn.jsdelivr.net">`;

const GTAG_BLOCK = `<script>
    window.dataLayer=window.dataLayer||[];
    function gtag(){dataLayer.push(arguments);}
    gtag('consent','default',{
      'ad_storage':'denied',
      'ad_user_data':'denied',
      'ad_personalization':'denied',
      'analytics_storage':'denied',
      'wait_for_update':500
    });
  </script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=AW-18106797178"></script>
  <script>
    gtag('js',new Date());
    gtag('config','AW-18106797178',{'conversion_linker':true});
    gtag('config','G-TLQ5WCBTJK',{'anonymize_ip':true});
  </script>`;

const COOKIE_CONSENT_BODY = `  <script defer src="${COOKIE_JS_URL}"></script>`;

const NETLIFY_FORM_DETECT = `<form name="richiamata" netlify netlify-honeypot="bot-field" hidden aria-hidden="true">
  <input type="hidden" name="form-name" value="richiamata">
  <input name="telefono" type="tel">
  <input name="zona" type="text">
  <input name="consenso_privacy" type="checkbox">
  <input name="bot-field">
</form>`;

const TICKER_ZONES = [
  'Verona Centro', 'Borgo Trento', 'Borgo Roma', 'San Zeno', 'Veronetta',
  'Golosine', 'Santa Lucia', 'Montorio', 'Borgo Milano', 'San Paolo',
  'Chievo', 'Valdonega', 'Cittadella', 'Filippini', 'Stadio',
];

const TICKER_SVG = `<svg class="sc2-ico" viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="14" y="7" width="16" height="7" rx="1.5"/><rect x="18" y="14" width="8" height="10" rx="1"/><rect x="10" y="24" width="24" height="7" rx="1.5"/><line x1="6" y1="26" x2="10" y2="26"/><line x1="6" y1="29" x2="10" y2="29"/><line x1="34" y1="26" x2="38" y2="26"/><line x1="34" y1="29" x2="38" y2="29"/><path d="M22 31 L20 35.5 Q20 38.5 22 38.5 Q24 38.5 24 35.5 Z" stroke-width="1.3"/></svg>`;

const FAQ_ICO = `<svg class="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2s7 8.5 7 13a7 7 0 11-14 0c0-4.5 7-13 7-13z"/></svg>`;
const TICK2 = `<span class="tick2"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></span>`;

const errors = [];
let generated = 0;

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractBetween(html, startRe, endMarker) {
  const m = html.match(startRe);
  if (!m) return '';
  const start = m.index;
  const rest = html.slice(start);
  const endIdx = rest.indexOf(endMarker, m[0].length);
  if (endIdx === -1) return '';
  return rest.slice(0, endIdx + endMarker.length);
}

function metaContent(html, name) {
  const re = new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, 'i');
  const m = html.match(re);
  return m ? m[1] : '';
}

function metaProperty(html, prop) {
  const re = new RegExp(`<meta\\s+property="${prop}"\\s+content="([^"]*)"`, 'i');
  const m = html.match(re);
  return m ? m[1] : '';
}

function canonical(html) {
  const m = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i);
  return m ? m[1] : '';
}

function ldJson(html) {
  const m = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  return m ? m[1].trim() : '';
}

function fixLdJson(raw) {
  if (!raw) return '';
  let fixed = raw
    .replace(/"item"\s*:\s*"https:\/\/gala400\.it\/index\.html"/g, '"item":"https://gala400.it/"')
    .replace(/"item"\s*:\s*"https:\/\/gala400\.it\/"/g, '"item":"https://gala400.it/"');
  return fixed;
}

function parseH1(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? stripTags(m[1]) : '';
}

function parseHeroLead(html) {
  const m = html.match(/<p\s+class="hero-lead[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  return m ? stripTags(m[1]) : '';
}

function parseCheckListItems(html) {
  const items = [];
  for (const cls of ['check-list', 'chk-list']) {
    const block = html.match(new RegExp(`<ul\\s+class="${cls}"[^>]*>([\\s\\S]*?)<\\/ul>`, 'i'));
    if (!block) continue;
    for (const m of block[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
      const text = stripTags(m[1]);
      if (text) items.push(text);
    }
    if (items.length) return items;
  }
  const tags = html.match(/<ul\s+class="inline-tags"[^>]*>([\s\S]*?)<\/ul>/i);
  if (tags) {
    for (const m of tags[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
      const text = stripTags(m[1]);
      if (text) items.push(text);
    }
  }
  return items;
}

function sanitizeProseHtml(inner) {
  if (!inner || BROKEN_HTML_RE.test(inner)) return null;
  const plain = stripTags(inner);
  if (!plain || plain.length < 12) return null;
  if (JUNK_PROSE_RE.test(plain)) return null;
  if (TRUST_LINE_RE.test(plain)) return null;
  return inner.trim();
}

function parseProseHeading(html) {
  const block = extractProseBlock(html);
  if (block) {
    const h2 = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (h2) {
      const t = stripTags(h2[1]);
      if (t && t.length > 8) return t;
    }
  }
  return '';
}

function parseStepCards(html) {
  const steps = [];
  for (const m of html.matchAll(/<div\s+class="step-card"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/gi)) {
    const t = stripTags(m[1]);
    if (t && !TRUST_LINE_RE.test(t)) steps.push(t);
  }
  return steps;
}

function parseServiceBlocks(html) {
  const blocks = [];
  for (const art of html.matchAll(/<article\s+class="service-block"[^>]*>([\s\S]*?)<\/article>/gi)) {
    const h3 = art[1].match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const p = art[1].match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const link = art[1].match(/<a\s+class="link-arrow"\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (h3) {
      const rawTitle = stripTags(h3[1]).replace(/^[A-Z]\s+/, '').trim();
      blocks.push({
        title: rawTitle,
        desc: p ? stripTags(p[1]) : '',
        href: link ? link[1] : '',
        linkLabel: link ? stripTags(link[2]).replace(/\s*→\s*$/, '') : '',
      });
    }
  }
  return blocks;
}

function extractProseBlock(html) {
  const open = html.match(/<div\s+class="[^"]*\bprose\b[^"]*"[^>]*>/i);
  if (!open) return '';
  const start = open.index + open[0].length;
  let depth = 1;
  let i = start;
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', i);
    const nextClose = html.indexOf('</div>', i);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
    } else {
      depth -= 1;
      if (depth === 0) return html.slice(start, nextClose);
      i = nextClose + 6;
    }
  }
  return '';
}

function parseProseParagraphs(html) {
  const paras = [];
  const seen = new Set();

  const addPara = (inner) => {
    const clean = sanitizeProseHtml(inner);
    if (!clean) return;
    const plain = stripTags(clean);
    if (seen.has(plain)) return;
    seen.add(plain);
    paras.push(clean);
  };

  const proseHtml = extractProseBlock(html);
  if (proseHtml) {
    const proseOnly = proseHtml
      .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '')
      .replace(/<article\s+class="service-block"[\s\S]*?<\/article>/gi, '')
      .replace(/<div\s+class="step-card"[\s\S]*?<\/div>/gi, '');
    for (const p of proseOnly.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
      addPara(p[1].trim());
    }
  }

  return paras.slice(0, 8);
}

function parseProcessSteps(html) {
  const steps = [];
  for (const m of html.matchAll(/<div\s+class="ps2"[^>]*>[\s\S]*?<div\s+class="ps2-n">(\d+)<\/div>[\s\S]*?<div\s+class="ps2-title">([\s\S]*?)<\/div>[\s\S]*?<p\s+class="ps2-desc">([\s\S]*?)<\/p>/gi)) {
    steps.push({ n: m[1], title: stripTags(m[2]), desc: stripTags(m[3]) });
  }
  return steps.slice(0, 3);
}

function parseCardLinksGrouped(html) {
  const grouped = { servizi: [], marche: [], quartieri: [], altreMarche: [] };
  for (const sec of html.matchAll(/<section[^>]*>([\s\S]*?)<\/section>/gi)) {
    const block = sec[1];
    if (!block.includes('card-link')) continue;
    const h2m = block.match(/<h2[^>]*class="[^"]*section-title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i);
    const title = h2m ? stripTags(h2m[1]).toLowerCase() : '';
    const links = [];
    for (const m of block.matchAll(/<a\s+class="card-link"\s+href="([^"]+)"[\s\S]*?<span\s+class="card-link-title">([\s\S]*?)<\/span>(?:[\s\S]*?<span\s+class="card-link-desc">([\s\S]*?)<\/span>)?/gi)) {
      links.push({ href: m[1], title: stripTags(m[2]), desc: m[3] ? stripTags(m[3]) : '' });
    }
    if (!links.length) continue;
    if (/altre marche/.test(title)) grouped.altreMarche.push(...links);
    else if (/marche|caldaie/.test(title)) grouped.marche.push(...links);
    else if (/zone|quartier/.test(title)) grouped.quartieri.push(...links);
    else if (/servizi/.test(title)) grouped.servizi.push(...links);
    else {
      for (const l of links) {
        if (l.href.includes('/servizi/')) grouped.servizi.push(l);
        else if (l.href.includes('/marche/')) grouped.marche.push(l);
        else if (l.href.includes('/quartieri/') || l.href.includes('idraulico-')) grouped.quartieri.push(l);
      }
    }
  }
  return grouped;
}

function brandFromPage(h1, filename) {
  let b = h1.replace(/Assistenza\s+(caldaia\s+)?/i, '').replace(/\s*Verona.*/i, '').trim();
  if (!b) b = filename.replace(/-verona\.html$/, '').replace(/-/g, ' ');
  return b.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function zoneFromPage(h1, filename) {
  let z = h1.replace(/Idraulico\s+(urgente\s+)?/i, '').replace(/\s*Verona.*/i, '').trim();
  if (!z) z = zoneNameFromFile(filename.replace(/^idraulico-/, 'idraulico-'));
  return z;
}

function parseServiceBlockChecklist(html) {
  const items = [];
  for (const art of html.matchAll(/<article\s+class="service-block"[^>]*>([\s\S]*?)<\/article>/gi)) {
    const p = art[1].match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const h3 = art[1].match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const text = p ? stripTags(p[1]) : h3 ? stripTags(h3[1]) : '';
    if (text) items.push(text);
  }
  return items.slice(0, 4);
}

const GENERIC_CHK_MARKERS = [
  "Perdite d'acqua da tubature",
  'Scarichi e WC bloccati',
  'Caldaie spente o guasti termici',
  'Emergenze gas — intervento h24',
];

function isGenericChecklist(items) {
  if (!items.length) return true;
  const hits = items.filter((i) => GENERIC_CHK_MARKERS.some((g) => i.includes(g.slice(0, 22)))).length;
  return hits >= 2;
}

function resolveChecklist(html, existingV2, sectionDir, h1, desc, filename) {
  let checkList = parseCheckListItems(html);
  if (!checkList.length) {
    checkList = html.includes('service-block') && sectionDir === 'marche'
      ? buildChecklistFallback(sectionDir, h1, desc, html)
      : parseServiceBlockChecklist(html);
  }
  if (!checkList.length || isGenericChecklist(checkList)) {
    const v2chk = parseCheckListItems(existingV2);
    if (v2chk.length && !isGenericChecklist(v2chk)) checkList = v2chk;
  }
  if (!checkList.length || isGenericChecklist(checkList)) {
    checkList = buildChecklistFallback(sectionDir, h1, desc, html);
  }
  if (sectionDir === 'quartieri' && checkList.every((i) => i.length < 32)) {
    const zone = zoneFromPage(h1, filename);
    checkList = checkList.map((t) => `${t} a ${zone}, Verona — intervento h24`);
  }
  return checkList;
}

function buildChecklistFallback(sectionDir, h1, desc, html) {
  const tags = [];
  const tagBlock = html.match(/<ul\s+class="inline-tags"[^>]*>([\s\S]*?)<\/ul>/i);
  if (tagBlock) {
    for (const m of tagBlock[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) tags.push(stripTags(m[1]));
  }

  if (sectionDir === 'marche') {
    const brand = brandFromPage(h1, '');
    return [
      `Caldaia ${brand} spenta, blocco o codice errore sul display`,
      `Manutenzione e controllo fumi caldaie ${brand} a Verona`,
      `Perdite acqua, rumori o pressione impianto ${brand}`,
      `Emergenza caldaia ${brand} — intervento h24 · ${PHONE_DISPLAY}`,
    ];
  }

  if (sectionDir === 'quartieri') {
    const zone = zoneFromPage(h1, '');
    const base = tags.length
      ? tags.map((t) => `${t} a ${zone} — pronto intervento`)
      : [
        `Perdite d'acqua e tubature rotte a ${zone}`,
        `Caldaie, scaldabagni e impianti termici`,
        `Scarichi, WC e spurghi intasati`,
        `Emergenze gas — intervento h24 a Verona`,
      ];
    return base.slice(0, 4);
  }

  const topic = stripTags(h1).replace(/\s*Verona.*/i, '').trim() || 'idraulico';
  return [
    `${topic} urgente a Verona e provincia`,
    `Arrivo medio ~20 minuti in città`,
    `Preventivo chiaro prima di iniziare i lavori`,
    `Disponibile h24 — chiama ${PHONE_DISPLAY}`,
  ];
}

function parseCardLinks(html) {
  const links = [];
  for (const m of html.matchAll(/<a\s+class="card-link"\s+href="([^"]+)"[\s\S]*?<span\s+class="card-link-title">([\s\S]*?)<\/span>(?:[\s\S]*?<span\s+class="card-link-desc">([\s\S]*?)<\/span>)?/gi)) {
    links.push({ href: m[1], title: stripTags(m[2]), desc: m[3] ? stripTags(m[3]) : '' });
  }
  return links;
}

async function ensureOldFile(section, file) {
  for (const base of [OLD_ROOT, OLD_REF]) {
    const local = path.join(base, section, file);
    if (fs.existsSync(local)) return local;
  }
  const local = path.join(OLD_REF, section, file);
  fs.mkdirSync(path.dirname(local), { recursive: true });
  const url = `${GITHUB_OLD}/${section}/${encodeURIComponent(file).replace(/%2F/g, '/')}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Old file not found: ${section}/${file}`);
  write(local, await res.text());
  return local;
}

function normalizeCardHref(href) {
  return href.replace(/^\.\.\//, '../');
}

function cardLinkLabel(title, href = '') {
  const t = stripTags(title);
  const afterDash = t.match(/\s*—\s*(.+)$/);
  if (afterDash) return afterDash[1].trim();
  if (href.includes('/quartieri/')) {
    const fn = href.match(/\/([^/]+)\.html$/)?.[1];
    if (fn) return zoneNameFromFile(fn);
  }
  if (href.includes('/marche/')) {
    const fn = href.match(/\/([^/]+)\.html$/)?.[1];
    if (fn) return brandFromPage('', fn);
  }
  if (href.includes('/servizi/')) {
    const fn = href.match(/\/([^/]+)\.html$/)?.[1];
    if (fn) {
      return fn.replace(/-verona\.html$/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
  return t.replace(/^Idraulico\s+(urgente\s+)?/i, '').replace(/\s*—.*$/, '').trim() || t;
}

const BALANCED_GRID_COUNTS = [32, 16, 12, 9, 8, 6, 4, 3, 2, 1];

function dedupeLinks(links) {
  const seen = new Set();
  return links.filter((l) => {
    const key = l.href;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeGridLinks(links, pool = []) {
  const unique = dedupeLinks(links);
  const n = unique.length;
  if (n === 0) return [];
  if (BALANCED_GRID_COUNTS.includes(n)) return unique;
  if (n <= 3) return unique.slice(0, n);

  const upper = [...BALANCED_GRID_COUNTS].reverse().find((t) => t > n);
  if (upper && upper - n <= 2) {
    const padded = dedupeLinks([...unique, ...pool]);
    if (padded.length >= upper) return padded.slice(0, upper);
  }

  const lower = BALANCED_GRID_COUNTS.find((t) => t <= n);
  return unique.slice(0, lower || 4);
}

function gridColsClass(count) {
  if (count === 1) return 'zone2-c1';
  if (count === 4) return 'zone2-c4';
  if (count === 9) return 'zone2-c9';
  if (count === 16) return 'zone2-c16';
  if (count === 6) return 'zone2-c6';
  if (count === 8) return 'zone2-c8';
  if (count === 12) return 'zone2-c12';
  if (count % 4 === 0) return 'zone2-c8';
  if (count % 3 === 0) return 'zone2-c6';
  return 'zone2-c2';
}

function renderFullLinkGrid(links) {
  const unique = dedupeLinks(links);
  return {
    items: renderZc2Items(unique),
    gridClass: gridColsClass(unique.length),
    count: unique.length,
    total: unique.length,
  };
}

function renderZc2Items(links) {
  return links.map((c) => {
    const href = normalizeCardHref(c.href);
    const name = cardLinkLabel(c.title, c.href);
    return `<a class="zc2" href="${href}"><span class="zdot2"></span><span class="zname2">${name}</span></a>`;
  }).join('');
}

function renderBalancedLinkGrid(links, pool = []) {
  const balanced = normalizeGridLinks(links, pool);
  return {
    items: renderZc2Items(balanced),
    gridClass: gridColsClass(balanced.length),
    count: balanced.length,
    total: dedupeLinks(links).length,
  };
}

function buildLinkGridSection(label, h2, links, ice = false, pool = []) {
  if (!links.length) return '';
  const grid = renderBalancedLinkGrid(links, pool.length ? pool : links);
  const cls = ice ? 'sec2 sec2-ice' : 'sec2';
  const moreLink = grid.total > grid.count
    ? `\n  <p style="margin-top:1.2rem"><a href="${moreLinkForLabel(label)}" class="link-more">${moreLabelForSection(label)} →</a></p>`
    : '';
  return `<section class="${cls}">
  <div class="lbl2">${label}</div>
  <h2>${h2}</h2>
  <div class="zone2-grid ${grid.gridClass}">${grid.items}</div>${moreLink}
</section>`;
}

function moreLinkForLabel(label) {
  if (label === 'Zone') return '../quartieri/index.html';
  if (label === 'Caldaie' || label === 'Altre marche') return '../marche/index.html';
  if (label === 'Servizi') return '../servizi/index.html';
  if (label === 'Marche caldaie') return 'index.html';
  if (label === 'Zone coperte') return '../quartieri/index.html';
  return '../index.html';
}

function moreLabelForSection(label) {
  if (label === 'Zone' || label === 'Zone coperte') return 'Tutte le zone Verona';
  if (label === 'Caldaie' || label === 'Altre marche' || label === 'Marche caldaie') return 'Tutte le marche';
  if (label === 'Servizi') return 'Tutti i servizi';
  return 'Vedi tutto';
}

function buildExtraLinkSections(cardLinks, grouped) {
  const g = grouped || {
    servizi: cardLinks.filter((c) => c.href.includes('/servizi/')),
    marche: cardLinks.filter((c) => c.href.includes('/marche/')),
    quartieri: cardLinks.filter((c) => c.href.includes('/quartieri/')),
    altreMarche: [],
  };
  const sections = [
    buildLinkGridSection('Servizi', 'Servizi idraulici<br>in zona.', g.servizi, false, cardLinks.filter((c) => c.href.includes('/servizi/'))),
    buildLinkGridSection('Caldaie', 'Assistenza caldaie<br>marche principali.', g.marche, true, cardLinks.filter((c) => c.href.includes('/marche/'))),
    buildLinkGridSection('Zone', 'Zone vicine.', g.quartieri, false, cardLinks.filter((c) => c.href.includes('/quartieri/'))),
  ];
  if (g.altreMarche.length) {
    sections.push(buildLinkGridSection('Altre marche', 'Altre marche<br>assistite.', g.altreMarche, true, cardLinks.filter((c) => c.href.includes('/marche/'))));
  }
  return sections.filter(Boolean).join('\n');
}

function buildProcessSection(steps) {
  if (steps?.length) {
    const cells = steps.map((s) =>
      `<div class="ps2"><div class="ps2-n">${String(s.n).padStart(2, '0')}</div><div class="ps2-title">${s.title}</div><p class="ps2-desc">${s.desc}</p></div>`,
    ).join('');
    return `<section class="sec2 sec2-ice">
  <div class="lbl2">Come intervengo</div>
  <h2>Tre passaggi.<br>Nessuna sorpresa.</h2>
  <div class="proc-grid">${cells}</div>
</section>`;
  }
  return `<section class="sec2 sec2-ice">
  <div class="lbl2">Come intervengo</div>
  <h2>Tre passaggi.<br>Nessuna sorpresa.</h2>
  <div class="proc-grid"><div class="ps2"><div class="ps2-n">01</div><div class="ps2-title">Mi chiami</div><p class="ps2-desc">Parli direttamente con me. Mi racconti il problema in 2 minuti.</p></div><div class="ps2"><div class="ps2-n">02</div><div class="ps2-title">Arrivo sul posto</div><p class="ps2-desc">Tempo medio ~20 minuti in città, con l'attrezzatura per la maggior parte dei guasti comuni.</p></div><div class="ps2"><div class="ps2-n">03</div><div class="ps2-title">Preventivo prima di iniziare</div><p class="ps2-desc">Vedi il costo prima che inizi a lavorare. Nessuna sorpresa in fattura.</p></div></div>
</section>`;
}

function generateProseFallback(sectionDir, h1, heroLead, desc, filename) {
  const plainH1 = stripTags(h1);
  const lead = heroLead || desc || '';
  if (sectionDir === 'marche') {
    const brand = brandFromPage(h1, filename);
    return [
      `<strong>Assistenza caldaie ${brand} a Verona</strong> — pronto intervento h24 su caldaie ${brand} spente, bloccate o con codice errore. Intervento sul posto con diagnosi e preventivo prima di iniziare.`,
      `Manutenzione, riparazione e sostituzione componenti per caldaie ${brand} a Verona e provincia. Chiama <a href="tel:${PHONE}">${PHONE_DISPLAY}</a> — arrivo medio ~20 minuti in città.`,
    ];
  }
  if (sectionDir === 'quartieri') {
    const zone = zoneFromPage(h1, filename);
    return [
      `<strong>Idraulico urgente a ${zone}, Verona</strong> — intervento h24 su perdite d'acqua, tubature rotte, scarichi intasati, caldaie e scaldabagni. ${lead}`,
      `Copertura completa del quartiere ${zone} e zone limitrofe. Preventivo chiaro prima dei lavori — chiama <a href="tel:${PHONE}">${PHONE_DISPLAY}</a>.`,
    ];
  }
  return lead ? [lead] : [
    `${plainH1} — intervento h24 a Verona e provincia. Chiama <a href="tel:${PHONE}">${PHONE_DISPLAY}</a> per un preventivo prima di iniziare.`,
  ];
}

function parseFaqFromHtml(html) {
  const faqs = [];
  for (const m of html.matchAll(/<details\s+class="faq"[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>\s*<div\s+class="faq-a"[^>]*>([\s\S]*?)<\/div>\s*<\/details>/gi)) {
    const q = stripTags(m[1]);
    const a = stripTags(m[2]);
    if (q && a) faqs.push({ q, a });
  }
  return faqs;
}

function parseFaqFromLd(jsonStr) {
  if (!jsonStr) return [];
  try {
    const data = JSON.parse(jsonStr);
    const graph = data['@graph'] || [data];
    for (const node of graph) {
      if (node['@type'] === 'FAQPage' && node.mainEntity) {
        return node.mainEntity.map((item) => ({
          q: item.name || '',
          a: item.acceptedAnswer?.text || '',
        })).filter((f) => f.q && f.a);
      }
    }
    if (data.mainEntity) {
      return data.mainEntity.map((item) => ({
        q: item.name || '',
        a: item.acceptedAnswer?.text || '',
      })).filter((f) => f.q && f.a);
    }
  } catch {
    /* ignore */
  }
  return [];
}

function zoneNameFromFile(filename) {
  return filename
    .replace(/^idraulico-/, '')
    .replace(/\.html$/, '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .replace(/Ca Di David/i, "Ca' di David")
    .replace(/San /g, 'San ');
}

function stripCookieConsent(html) {
  return html
    .replace(/<link rel="stylesheet" href="https:\/\/cdn\.jsdelivr\.net\/gh\/orestbida\/cookieconsent[^"]*"[^>]*>\s*/gi, '')
    .replace(/<link rel="preload" as="style" href="https:\/\/cdn\.jsdelivr\.net\/gh\/orestbida\/cookieconsent[^"]*"[^>]*>\s*/gi, '')
    .replace(/<noscript>\s*<link rel="stylesheet" href="https:\/\/cdn\.jsdelivr\.net\/gh\/orestbida\/cookieconsent[^"]*"[^>]*>\s*<\/noscript>\s*/gi, '')
    .replace(/<script defer src="https:\/\/cdn\.jsdelivr\.net\/gh\/orestbida\/cookieconsent[^"]*"[^>]*><\/script>\s*/gi, '');
}

function ensureCookieConsentBody(html) {
  let out = stripCookieConsent(html);
  if (!out.includes('cookieconsent.umd.js')) {
    out = out.replace(/<body([^>]*)>/, `<body$1>\n${COOKIE_CONSENT_BODY}`);
  }
  if (!out.includes(COOKIE_CSS_URL) && !out.includes('gala400LoadCookieCss')) {
    out = out.replace(
      /document\.addEventListener\('DOMContentLoaded', function\(\)\{/,
      `function gala400LoadCookieCss(cb){
  if(document.querySelector('link[data-cc-css]')){cb();return;}
  var l=document.createElement('link');
  l.rel='stylesheet';l.href='${COOKIE_CSS_URL}';l.setAttribute('data-cc-css','1');
  l.onload=cb;l.onerror=cb;document.head.appendChild(l);
}
document.addEventListener('DOMContentLoaded', function(){`,
    );
    out = out.replace(
      /document\.addEventListener\('DOMContentLoaded', function\(\)\{\s*\n\s*if \(typeof CookieConsent === 'undefined'\) return;/,
      `document.addEventListener('DOMContentLoaded', function(){
  gala400LoadCookieCss(function(){
  if (typeof CookieConsent === 'undefined') return;`,
    );
    out = out.replace(
      /(\s*onChange: onChangeHandler\s*\n\s*\}\);)\s*\n\}\);/,
      `$1
  });
});`,
    );
  }
  return out;
}

function applyPerformancePolish(html) {
  let out = html;
  out = out.replace(
    /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]*" rel="stylesheet">/gi,
    FONTS_HEAD.trim(),
  );
  out = out.replace(
    /<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=AW-18106797178"><\/script>\s*/gi,
    '',
  );
  if (!out.includes('gala400LoadGtag')) {
    out = out.replace(
      /<script>\s*\n\s*gtag\('js',new Date\(\)\);/g,
      `<script>
    (function(){
      function gala400LoadGtag(){
        if(window.__gala400GtagJs)return;
        window.__gala400GtagJs=1;
        var s=document.createElement('script');
        s.async=true;
        s.src='https://www.googletagmanager.com/gtag/js?id=AW-18106797178';
        document.head.appendChild(s);
      }
      if('requestIdleCallback' in window){
        requestIdleCallback(gala400LoadGtag,{timeout:3500});
      }else{
        window.addEventListener('load',function(){setTimeout(gala400LoadGtag,2000);});
      }
    })();
  </script>
  <script>
    gtag('js',new Date());`,
    );
  }
  out = out.replace(/<script src="(\.\.\/)*js\/gala400-tracking\.js"><\/script>/gi, '<script defer src="$1js/gala400-tracking.js"></script>');
  out = ensureCookieConsentBody(out);
  if (!out.includes('dns-prefetch" href="https://cdn.jsdelivr.net"')) {
    out = out.replace('</head>', `${COOKIE_CONSENT_HEAD}\n</head>`);
  }
  return out;
}

function ensureSingleCookieConsent(html) {
  let out = stripCookieConsent(html);
  if (!out.includes('dns-prefetch" href="https://cdn.jsdelivr.net"')) {
    out = out.replace('</head>', `${COOKIE_CONSENT_HEAD}\n</head>`);
  }
  return ensureCookieConsentBody(out);
}

function ensureNetlifyFormDetect(html) {
  if (html.includes('name="richiamata"') && html.includes('data-netlify="true"')) return html;
  if (html.includes('netlify-honeypot="bot-field" hidden')) return html;
  return html.replace('<body', `${NETLIFY_FORM_DETECT}\n<body`);
}

function loadTemplate() {
  const html = ensureSingleCookieConsent(read(TEMPLATE));
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  const style = styleMatch ? `<style>${styleMatch[1]}</style>` : '';
  const logoMatch = html.match(/<nav class="nav2"[\s\S]*?<img src="(data:image\/png;base64,[^"]+)"/);
  const logoBase64 = logoMatch ? logoMatch[1] : '';
  const contact2 = extractBetween(html, /<section class="contact2"/, '</section>');
  const footerTail = html.slice(html.indexOf('<footer class="foot-pro">'));
  const gtagBlock = GTAG_BLOCK;
  return { style, logoBase64, contact2, footerTail, gtagBlock };
}

function buildTicker() {
  const items = [...TICKER_ZONES, ...TICKER_ZONES].map(
    (z) => `<span class="t-item">${z} <span class="t-dot">✦</span></span>`,
  );
  return `<div class="ticker"><div class="ticker-track">${items.join('')}</div></div>`;
}

function buildNav(logoBase64, prefix = '') {
  const home = prefix ? '/' : '/';
  return `<nav class="nav2">
  <a class="nav2-logo" href="${home}"><img src="${logoBase64}" alt="Gala 400 logo"><span>GALA 400</span></a>
  <ul class="nav2-links">
    <li><a href="/#servizi">Servizi</a></li>
    <li><a href="/servizi/">Tutti i servizi</a></li>
    <li><a href="/quartieri/">Zone</a></li>
    <li><a href="/marche/">Caldaie</a></li>
    <li><a href="tel:${PHONE}" class="nav2-cta">${PHONE_DISPLAY}</a></li>
  </ul>
  <button class="hbg2" id="hbg2" aria-label="Menu"><span></span><span></span><span></span></button>
</nav>
<div class="nav2-mobile" id="nav2mobile">
  <a href="/#servizi">Servizi</a>
  <a href="/servizi/">Tutti i servizi</a>
  <a href="/quartieri/">Zone</a>
  <a href="/marche/">Caldaie</a>
  <a href="tel:${PHONE}">${PHONE_DISPLAY}</a>
</div>`;
}

function buildHero2(h1, tagline, waText) {
  const wa = encodeURIComponent(waText || 'Richiesta idraulico urgente Verona');
  return `<section class="hero2">
  <div class="hero2-glow"></div>
  <div class="hero2-fade"></div>
  <div class="hero2-content">
    <div class="hero2-left">
      <div class="hero2-badge"><span class="live-dot" aria-hidden="true"></span>Disponibile ora · Verona e provincia</div>
      <h1 class="hero2-h1">${h1}</h1>
      <p class="hero2-tagline">${tagline || `Intervento idraulico h24 a Verona e provincia. Chiama ${PHONE_DISPLAY} — arrivo medio ~20 minuti, preventivo prima dei lavori.`}</p>
      <div class="hero2-btns">
        <a href="tel:${PHONE}" class="hbtn hbtn-solid" data-cta="hero2-call">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.69 12 19.79 19.79 0 011.61 3.41 2 2 0 013.6 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.91 8.6a16 16 0 006 6l.96-.96a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
          ${PHONE_DISPLAY}
        </a>
        <a href="https://wa.me/393494208551?text=${wa}" class="hbtn hbtn-ghost" rel="noopener" target="_blank" data-cta="hero2-wa-secondary">Scrivi su WhatsApp</a>
      </div>
    </div>
    <div class="hero2-contact">
      <p class="hc-label">Emergenza idraulica</p>
      <a href="tel:${PHONE}" class="hc-phone" data-cta="hero2-contact-call">${PHONE_DISPLAY}</a>
      <p class="hc-meta">Gala 400 Srls · P.IVA 05180000233 · H24</p>
      <a href="https://wa.me/393494208551?text=${wa}" class="hc-wa" rel="noopener" target="_blank" data-cta="hero2-wa">
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51-.17 0-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.48s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.7.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35"/><path d="M12 2a10 10 0 00-8.5 15.2L2 22l4.9-1.5A10 10 0 1012 2z"/></svg>
        WhatsApp
      </a>
    </div>
  </div>
</section>`;
}

function buildCheckSection(items, title = 'Quando chiamarmi', subtitle = 'Non aspettare<br>che peggiori.') {
  if (!items.length) {
    items = [
      'Perdite d\'acqua da tubature, rubinetti o sanitari',
      'Scarichi e WC bloccati',
      'Caldaie spente o guasti termici',
      'Emergenze gas — intervento h24',
    ];
  }
  const lis = items.map((t) => `<li>${TICK2}${t}</li>`).join('');
  return `<section class="sec2">
  <div class="lbl2">${title}</div>
  <h2>${subtitle}</h2>
  <ul class="chk-list" style="margin-top:1.6rem;max-width:38rem">${lis}</ul>
</section>`;
}

function detailSectionLabel(sectionDir) {
  if (sectionDir === 'marche') return 'Assistenza';
  if (sectionDir === 'quartieri') return 'In zona';
  return 'Il servizio';
}

function detailH2(heading, h1, sectionDir, filename) {
  const plain = stripTags(heading || h1);
  if (sectionDir === 'quartieri') {
    const z = zoneFromPage(h1, filename);
    return `${z}.`;
  }
  if (sectionDir === 'marche') {
    const b = brandFromPage(h1, filename);
    return `Caldaie ${b}.`;
  }
  if (sectionDir === 'servizi') {
    let t = plain.replace(/^Idraulico\s+/i, '').trim();
    if (!/\bverona\b/i.test(t)) t += ' a Verona';
    t = t.charAt(0).toUpperCase() + t.slice(1);
    return t.endsWith('.') ? t : `${t}.`;
  }
  const trimmed = plain.replace(/\s+a Verona.*$/i, '').replace(/\s+Verona.*$/i, '');
  const m = trimmed.match(/^(?:Idraulico|Assistenza|Pronto intervento|Emergenza)\s+(?:per\s+|urgente\s+)?(.+)/i);
  if (m?.[1]) return `${m[1].charAt(0).toUpperCase()}${m[1].slice(1)}.`;
  return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
}

function detailStats(sectionDir, h1, filename) {
  if (sectionDir === 'marche') {
    const b = brandFromPage(h1, filename);
    const short = b.split(' ')[0].slice(0, 10);
    return [
      { v: 'H24', l: 'Pronto intervento' },
      { v: '20 min', l: 'Arrivo medio' },
      { v: '100%', l: 'Preventivo prima' },
      { v: short, l: 'Marca assistita' },
    ];
  }
  if (sectionDir === 'quartieri') {
    const z = zoneFromPage(h1, filename);
    const short = z.split(' ').slice(-1)[0].slice(0, 8);
    return [
      { v: 'H24', l: 'Reperibilità' },
      { v: '20 min', l: 'Arrivo medio' },
      { v: short, l: 'Quartiere' },
      { v: 'VR', l: 'Verona' },
    ];
  }
  return [
    { v: 'H24', l: 'Reperibilità' },
    { v: '20 min', l: 'Arrivo medio' },
    { v: '100%', l: 'Preventivo prima' },
    { v: 'RC Prof.', l: 'Assicurazione' },
  ];
}

function buildDetailSection({ prose, h1, sectionDir, filename, sourceHtml, checkList, serviceBlocks }) {
  const heading = parseProseHeading(sourceHtml) || stripTags(h1);
  const bodyParas = prose.filter((p) => stripTags(p).length > 25).slice(0, 2);
  if (!bodyParas.length && !prose.length) return '';

  const stepItems = parseStepCards(sourceHtml);
  const hasBlocks = serviceBlocks?.length > 0;
  const listItems = hasBlocks
    ? []
    : stepItems.length
      ? stepItems.slice(0, 4)
      : (checkList || []).slice(0, 4);

  const label = detailSectionLabel(sectionDir);
  const h2 = detailH2(heading, h1, sectionDir, filename);
  const bodyHtml = (bodyParas.length ? bodyParas : prose.slice(0, 2))
    .map((p) => `<p class="chi2-body">${p}</p>`)
    .join('\n      ');
  const listHtml = listItems.length
    ? `<ul class="chi2-list">${listItems.map((i) => `<li>${TICK2}${i}</li>`).join('')}</ul>`
    : '';
  const stats = detailStats(sectionDir, h1, filename);
  const statsHtml = stats.map((s) =>
    `<div class="cn2"><div class="cn2-v">${s.v}</div><div class="cn2-l">${s.l}</div></div>`,
  ).join('\n      ');

  return `<section class="chi2">
  <div class="chi2-inner">
    <div class="chi2-l">
      <div class="lbl2">${label}</div>
      <h2>${h2}</h2>
      ${bodyHtml}
      ${listHtml}
    </div>
    <div class="chi2-stats">
      ${statsHtml}
    </div>
  </div>
</section>`;
}

function fourthMarcheBlock(brand) {
  return {
    title: `Emergenza caldaia ${brand} h24`,
    desc: `Caldaia ${brand} guasta di notte o nel weekend? Linea diretta h24 a Verona — arrivo medio ~20 minuti, preventivo comunicato prima di iniziare.`,
    href: '../servizi/pronto-intervento-idraulico-verona.html',
    linkLabel: 'Pronto intervento h24 Verona',
  };
}

function normalizeServiceBlocks(blocks, brand, sectionDir) {
  if (sectionDir !== 'marche' || !blocks.length) return blocks;
  const items = blocks.map((b) => ({
    ...b,
    desc: b.desc.replace(/\s+:\s+/g, ' — ').trim(),
  }));
  if (items.length === 3) items.push(fourthMarcheBlock(brand));
  return items.slice(0, 4);
}

function buildServiceBlocksSection(blocks, brand, sectionDir) {
  const items = normalizeServiceBlocks(blocks, brand, sectionDir);
  if (!items.length) return '';
  const cards = items.map((b, i) => {
    const num = String(i + 1).padStart(2, '0');
    const href = b.href ? normalizeCardHref(b.href) : '';
    const link = href
      ? `<a class="sc2-link" href="${href}">${b.linkLabel || 'Scopri di più'} →</a>`
      : '';
    return `<div class="sc2">
  <div class="sc2-num">${num}</div>
  ${CALDAIA_ICO}
  <div class="sc2-title">${b.title}</div>
  <p class="sc2-desc">${b.desc}</p>
  ${link}
</div>`;
  }).join('');
  return `<section class="sec2 sec2-ice">
  <div class="lbl2">Interventi</div>
  <h2>Cosa facciamo<br>sul posto.</h2>
  <div class="srv2-grid">${cards}</div>
</section>`;
}

function buildSeoProseHidden(paras, shownCount = 2) {
  const extra = paras.filter((p) => stripTags(p).length > 35).slice(shownCount);
  if (!extra.length) return '';
  const ps = extra.map((p) => `<p>${p}</p>`).join('\n    ');
  return `<section class="seo-only" aria-hidden="true">
  <div class="prose2">${ps}</div>
</section>`;
}

function buildZoneGrid(cardLinks, sectionDir) {
  const zoneLinks = cardLinks.filter((c) => c.href.includes('/quartieri/'));
  if (!zoneLinks.length) return '';
  const pool = zoneLinks.map((c) => ({ ...c, href: c.href.replace(/^\.\.\//, '../') }));
  const grid = renderBalancedLinkGrid(pool, pool);
  const more = grid.total > grid.count
    ? `\n  <p style="margin-top:1.2rem"><a href="../quartieri/index.html" class="link-more">Tutte le zone Verona →</a></p>`
    : '';
  return `<section class="sec2 seo-only" aria-hidden="true">
  <div class="lbl2">Zone coperte</div>
  <h2>Intervento<br>in zona.</h2>
  <div class="zone2-grid ${grid.gridClass}">${grid.items}</div>${more}
</section>`;
}

function buildFaqSection(faqs) {
  if (!faqs.length) return '';
  const details = faqs.map((f) =>
    `<details class="faq"><summary><span class="faq-ico" aria-hidden="true">${FAQ_ICO}</span>${f.q}</summary><div class="faq-a"><p>${f.a}</p></div></details>`,
  ).join('');
  return `<section class="section section-alt"><div class="container container-narrow">
  <h2 class="section-title"><span class="section-title-ico" aria-hidden="true">${FAQ_ICO.replace('width="18"', 'width="22"')}</span>Domande frequenti</h2>
  <div class="faq-list">${details}</div>
</div></section>`;
}

function buildHead(meta, tpl, prefix) {
  const p = prefix || '';
  const canon = meta.canonical || `https://gala400.it/${meta.sectionDir}/${meta.filename}`;
  const ld = meta.ldJson ? `\n  <script type="application/ld+json">${fixLdJson(meta.ldJson)}</script>` : '';
  const keywords = meta.keywords ? `\n  <meta name="keywords" content="${meta.keywords}">` : '';
  const ogImage = meta.ogImage || 'https://gala400.it/assets/lavori/spurgo-08-autospurgo.jpg';
  return `<!DOCTYPE html>
<html lang="it-IT">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.title}</title>
  <meta name="description" content="${meta.description.replace(/"/g, '&quot;')}">
  <meta name="robots" content="index, follow, max-snippet:-1">
  <meta name="geo.region" content="IT-VR">
  <meta name="geo.placename" content="Verona">
  <meta name="geo.position" content="45.4384;10.9916">
  <meta name="ICBM" content="45.4384, 10.9916">
  <meta name="format-detection" content="telephone=yes">
  <link rel="canonical" href="${canon}">
  <link rel="alternate" hreflang="it-IT" href="${canon}">
  <link rel="alternate" hreflang="x-default" href="${canon}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="it_IT">
  <meta property="og:title" content="${meta.ogTitle || meta.title}">
  <meta property="og:description" content="${(meta.ogDescription || meta.description).replace(/"/g, '&quot;')}">
  <meta property="og:url" content="${meta.ogUrl || canon}">
  <meta property="og:site_name" content="Gala 400 — Idraulico Verona">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="640">
  <meta property="og:image:height" content="480">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#0d2038">
  <link rel="manifest" href="${p}site.webmanifest">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" href="/assets/favicon-32.png" sizes="32x32">
  <link rel="icon" type="image/png" href="/assets/favicon-192.png" sizes="192x192">
  <link rel="apple-touch-icon" href="/assets/favicon-180.png">
${FONTS_HEAD}${keywords}
  ${tpl.style}
  ${SEO_ONLY_STYLE}
  ${tpl.gtagBlock}
${COOKIE_CONSENT_HEAD}${ld}
</head>`;
}

async function generatePage(oldPath, outPath, sectionDir, tpl) {
  try {
    const html = read(oldPath);
    const filename = path.basename(oldPath);
    const existingV2 = fs.existsSync(outPath) ? read(outPath) : '';

    const h1 = parseH1(html) || parseH1(existingV2) || metaContent(html, 'description').slice(0, 80);
    const heroLead = parseHeroLead(html) || parseHeroLead(existingV2) || metaContent(html, 'description');
    const desc = metaContent(html, 'description') || metaContent(existingV2, 'description');

    let checkList = resolveChecklist(html, existingV2, sectionDir, h1, desc, filename);

    let processSteps = parseProcessSteps(html);
    if (!processSteps.length) processSteps = parseProcessSteps(existingV2);

    const grouped = parseCardLinksGrouped(html);
    let cardLinks = parseCardLinks(html);
    if (!cardLinks.length) cardLinks = parseCardLinks(existingV2);

    let prose = parseProseParagraphs(html);
    if (prose.length < 2) {
      prose = generateProseFallback(sectionDir, h1, heroLead, desc, filename);
    }

    const serviceBlocks = parseServiceBlocks(html);

    const ldRaw = ldJson(html) || ldJson(existingV2);
    let faqs = parseFaqFromLd(ldRaw);
    if (!faqs.length) faqs = parseFaqFromHtml(html);
    if (!faqs.length) faqs = parseFaqFromHtml(existingV2);

    const meta = {
      title: html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || h1,
      description: desc,
      keywords: metaContent(html, 'keywords') || metaContent(existingV2, 'keywords'),
      canonical: canonical(html) || canonical(existingV2),
      ogTitle: metaProperty(html, 'og:title') || metaProperty(existingV2, 'og:title'),
      ogDescription: metaProperty(html, 'og:description') || metaProperty(existingV2, 'og:description'),
      ogUrl: metaProperty(html, 'og:url') || metaProperty(existingV2, 'og:url'),
      ogImage: metaProperty(html, 'og:image') || metaProperty(existingV2, 'og:image'),
      ldJson: ldRaw,
      filename,
      sectionDir,
    };

    const waText = `Richiesta idraulico ${stripTags(h1).slice(0, 60)} Verona`;
    const body = `${buildNav(tpl.logoBase64, '../')}
<main>
${buildHero2(h1, heroLead, waText)}
${buildTicker()}
${buildCheckSection(checkList)}
${buildProcessSection(processSteps)}
${buildDetailSection({ prose, h1, sectionDir, filename, sourceHtml: html, checkList, serviceBlocks })}
${buildServiceBlocksSection(serviceBlocks, brandFromPage(h1, filename), sectionDir)}
${buildSeoProseHidden(prose)}
${buildExtraLinkSections(cardLinks, grouped)}
${buildZoneGrid(cardLinks, sectionDir)}
${buildFaqSection(faqs)}
${tpl.contact2}
</main>
${tpl.footerTail}`;

    let page = `${buildHead(meta, tpl, '../')}
<body class="home-v2">
${body}`;
    page = ensureSingleCookieConsent(page);
    write(outPath, page);
    generated++;
    return { h1, filename, heroLead };
  } catch (e) {
    errors.push(`${oldPath}: ${e.message}`);
    return null;
  }
}

async function migrateSection(section, tpl) {
  const newDir = path.join(NEW_ROOT, section);
  if (!fs.existsSync(newDir)) {
    errors.push(`Missing new dir: ${newDir}`);
    return [];
  }
  const files = fs.readdirSync(newDir).filter((f) => f.endsWith('.html') && f !== 'index.html').sort();
  const results = [];
  for (const file of files) {
    let oldPath;
    try {
      oldPath = await ensureOldFile(section, file);
    } catch (e) {
      errors.push(`${section}/${file}: ${e.message}`);
      continue;
    }
    const info = await generatePage(oldPath, path.join(newDir, file), section, tpl);
    if (info) results.push(info);
  }
  return results;
}

function insertBeforeContact(html, block) {
  const marker = '<section class="contact2"';
  const idx = html.indexOf(marker);
  if (idx === -1) return html;
  return `${html.slice(0, idx)}${block}\n${html.slice(idx)}`;
}

function patchListingIndexChecklist(filePath, items) {
  if (!fs.existsSync(filePath)) return;
  let html = read(filePath);
  const lis = items.map((t) => `<li>${TICK2}${t}</li>`).join('');
  html = html.replace(
    /<ul class="chk-list"[^>]*>[\s\S]*?<\/ul>/,
    `<ul class="chk-list" style="margin-top:1.6rem;max-width:38rem">${lis}</ul>`,
  );
  write(filePath, html);
}

function patchListingIndexChecklists() {
  patchListingIndexChecklist(path.join(NEW_ROOT, 'servizi', 'index.html'), [
    'Pronto intervento idraulico h24 a Verona e provincia',
    'Perdite d\'acqua, spurghi, caldaie e allagamenti',
    'Preventivo chiaro prima di iniziare i lavori',
    `Disponibile h24 — chiama ${PHONE_DISPLAY}`,
  ]);
  patchListingIndexChecklist(path.join(NEW_ROOT, 'quartieri', 'index.html'), [
    'Idraulico urgente in ogni quartiere di Verona',
    'Perdite d\'acqua, caldaie, scarichi e emergenze gas',
    'Arrivo medio ~20 minuti in città',
    `Intervento h24 · ${PHONE_DISPLAY}`,
  ]);
  patchListingIndexChecklist(path.join(NEW_ROOT, 'marche', 'index.html'), [
    'Assistenza caldaie di tutte le marche a Verona',
    'Caldaia spenta, blocco o codice errore sul display',
    'Manutenzione, riparazione e controllo fumi',
    `Emergenza caldaia h24 · ${PHONE_DISPLAY}`,
  ]);
}

function fixIndexListingPages() {
  fixServiziIndexPage();
  fixQuartieriIndexPage();
  fixMarcheIndexPage();
  patchListingIndexChecklists();
}

function fixServiziIndexPage() {
  const indexPath = path.join(NEW_ROOT, 'servizi', 'index.html');
  if (!fs.existsSync(indexPath)) return;
  let html = read(indexPath);
  const servizi = parseServiziForIndex();
  const gridHtml = buildSrv2Grid(servizi);
  const block = `<section class="sec2">
  <div class="lbl2">Elenco servizi</div>
  <h2>Tutti i servizi<br>a Verona.</h2>
  <div class="srv2-grid">${gridHtml}</div>
</section>

`;
  html = html.replace(
    /<section class="sec2">\s*<div class="lbl2">Elenco servizi[\s\S]*?<\/section>\s*\n\s*\n/,
    '',
  );
  html = insertBeforeContact(html, block);
  if (!html.includes(SEO_ONLY_STYLE)) {
    html = html.replace('</head>', `  ${SEO_ONLY_STYLE}\n</head>`);
  }
  write(indexPath, html);
}

function fixQuartieriIndexPage() {
  const indexPath = path.join(NEW_ROOT, 'quartieri', 'index.html');
  if (!fs.existsSync(indexPath)) return;
  let html = read(indexPath);
  const zoneGrid = buildZone2GridHome();
  const block = `<section class="sec2">
  <div class="lbl2">Zone coperte</div>
  <h2>Verona.<br>Ogni quartiere.</h2>
  <div class="zone2-grid ${zoneGrid.gridClass}">${zoneGrid.items}</div>
</section>

`;
  html = html.replace(
    /<section class="sec2">\s*<div class="lbl2">Zone coperte[\s\S]*?<\/section>\s*\n\s*\n/,
    '',
  );
  html = insertBeforeContact(html, block);
  if (!html.includes(SEO_ONLY_STYLE)) {
    html = html.replace('</head>', `  ${SEO_ONLY_STYLE}\n</head>`);
  }
  write(indexPath, html);
}

function fixMarcheIndexPage() {
  const indexPath = path.join(NEW_ROOT, 'marche', 'index.html');
  if (!fs.existsSync(indexPath)) return;
  let html = read(indexPath);
  const dir = path.join(NEW_ROOT, 'marche');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'index.html').sort();
  const links = files.map((file) => {
    const page = read(path.join(dir, file));
    const h1 = parseH1(page);
    let name = h1.replace(/Assistenza caldaia\s*/i, '').replace(/Verona.*$/i, '').trim();
    if (!name) name = file.replace(/-verona\.html$/, '').replace(/-/g, ' ');
    name = name.charAt(0).toUpperCase() + name.slice(1);
    return { href: file, title: name };
  });
  const grid = renderFullLinkGrid(links);
  const block = `<section class="sec2">
  <div class="lbl2">Marche caldaie</div>
  <h2>Assistenza<br>caldaie Verona.</h2>
  <div class="zone2-grid ${grid.gridClass}">${grid.items}</div>
</section>

`;
  html = html.replace(
    /<section class="sec2">\s*<div class="lbl2">Marche caldaie[\s\S]*?<\/section>\s*\n\s*\n/,
    '',
  );
  html = insertBeforeContact(html, block);
  if (!html.includes(SEO_ONLY_STYLE)) {
    html = html.replace('</head>', `  ${SEO_ONLY_STYLE}\n</head>`);
  }
  write(indexPath, html);
}

function applyHreflangToFile(filePath, canonUrl) {
  if (!fs.existsSync(filePath)) return;
  let html = read(filePath);
  if (html.includes('hreflang="it-IT"')) return;
  const block = `  <link rel="alternate" hreflang="it-IT" href="${canonUrl}">\n  <link rel="alternate" hreflang="x-default" href="${canonUrl}">\n`;
  html = html.replace(/(<link rel="canonical" href="[^"]*">)/, `$1\n${block}`);
  if (!html.includes('name="ICBM"')) {
    html = html.replace(
      /(<meta name="geo.position" content="45.4384;10.9916">)/,
      `$1\n  <meta name="ICBM" content="45.4384, 10.9916">`,
    );
  }
  write(filePath, html);
}

function applyHreflangAll() {
  applyHreflangToFile(path.join(NEW_ROOT, 'index.html'), 'https://gala400.it/');
  for (const extra of ['cookie-policy.html', 'privacy-policy.html']) {
    applyHreflangToFile(path.join(NEW_ROOT, extra), `https://gala400.it/${extra}`);
  }
  for (const section of ['servizi', 'quartieri', 'marche']) {
    const dir = path.join(NEW_ROOT, section);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.html'))) {
      const canon = file === 'index.html'
        ? `https://gala400.it/${section}/`
        : `https://gala400.it/${section}/${file}`;
      applyHreflangToFile(path.join(dir, file), canon);
    }
  }
}

function polishAllPages() {
  const files = [];
  for (const f of ['index.html', 'cookie-policy.html', 'privacy-policy.html', '404.html', 'sitemap.xml']) {
    const p = path.join(NEW_ROOT, f);
    if (fs.existsSync(p)) files.push(p);
  }
  for (const section of ['servizi', 'quartieri', 'marche']) {
    const dir = path.join(NEW_ROOT, section);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.html'))) {
      files.push(path.join(dir, file));
    }
  }
  for (const file of files) {
    if (!file.endsWith('.html')) continue;
    let html = read(file);
    html = applyPerformancePolish(html);
    html = ensureSingleCookieConsent(html);
    if (file.endsWith(`${path.sep}index.html`) && !file.includes(`${path.sep}servizi${path.sep}`) && !file.includes(`${path.sep}quartieri${path.sep}`) && !file.includes(`${path.sep}marche${path.sep}`)) {
      html = ensureNetlifyFormDetect(html);
    }
    if (html.includes('<form name="richiamata"') && !html.includes('gala400-tracking.js')) {
      html = html.replace('</body>', '  <script defer src="js/gala400-tracking.js"></script>\n</body>');
    }
    write(file, html);
  }
}

function updateSitemap() {
  const candidates = [
    path.join(OLD_ROOT, 'sitemap.xml'),
    path.join(OLD_REF, 'sitemap.xml'),
    path.join(NEW_ROOT, 'sitemap.xml'),
  ];
  const src = candidates.find((p) => fs.existsSync(p));
  if (!src) {
    errors.push('sitemap.xml not found');
    return;
  }
  let xml = read(src);
  xml = xml.replace(/<lastmod>[^<]*<\/lastmod>/g, `<lastmod>${LASTMOD}</lastmod>`);
  write(path.join(NEW_ROOT, 'sitemap.xml'), xml);
}

function parseServiziForIndex() {
  const dir = path.join(NEW_ROOT, 'servizi');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'index.html').sort();
  return files.map((file, i) => {
    const html = read(path.join(dir, file));
    const h1 = parseH1(html);
    const desc = parseHeroLead(html) || metaContent(html, 'description');
    const title = h1 || file.replace(/\.html$/, '').replace(/-/g, ' ');
    const num = String(i + 1).padStart(2, '0');
    return { file, title, desc, num };
  });
}

function buildSrv2Grid(cards) {
  return cards.map((c) => `<div class="sc2">
  <div class="sc2-num">${c.num}</div>
  ${TICKER_SVG}
  <div class="sc2-title">${c.title}</div>
  <p class="sc2-desc">${c.desc.slice(0, 140)}${c.desc.length > 140 ? '…' : ''}</p>
  <a class="sc2-link" href="servizi/${c.file}">Scopri di più →</a>
</div>`).join('');
}

function buildZone2GridHome() {
  const dir = path.join(NEW_ROOT, 'quartieri');
  const files = fs.readdirSync(dir).filter((f) => f.startsWith('idraulico-') && f.endsWith('.html')).sort();
  const links = files.map((file) => {
    const html = read(path.join(dir, file));
    const h1 = parseH1(html);
    let name = h1.replace(/Idraulico urgente\s*/i, '').replace(/Idraulico\s*/i, '').trim();
    if (!name) name = zoneNameFromFile(file);
    name = name.replace(/\s*Verona.*$/i, '').trim() || zoneNameFromFile(file);
    return { href: `quartieri/${file}`, title: name };
  });
  return renderFullLinkGrid(links);
}

function updateIndex() {
  const indexPath = path.join(NEW_ROOT, 'index.html');
  let html = read(indexPath);

  // Nav links
  const navInsert = `<li><a href="/servizi/">Tutti i servizi</a></li>
    <li><a href="/quartieri/">Zone</a></li>
    <li><a href="/marche/">Caldaie</a></li>`;
  if (!html.includes('href="/servizi/"')) {
    html = html.replace(
      /(<ul class="nav2-links">\s*\n\s*<li><a href="#servizi">Servizi<\/a><\/li>)/,
      `$1\n    ${navInsert}`,
    );
  }
  if (!html.includes('nav2mobile') || !html.match(/nav2mobile[\s\S]*href="\/servizi\/"/)) {
    html = html.replace(
      /(<div class="nav2-mobile" id="nav2mobile">\s*\n\s*<a href="#servizi">Servizi<\/a>)/,
      `$1\n  <a href="/servizi/">Tutti i servizi</a>\n  <a href="/quartieri/">Zone</a>\n  <a href="/marche/">Caldaie</a>`,
    );
  }

  // srv2-grid
  const servizi = parseServiziForIndex();
  const gridHtml = buildSrv2Grid(servizi);
  html = html.replace(
    /<div class="srv2-grid">[\s\S]*?<\/div>\s*\n<\/section>\s*\n\s*<section class="sec2 sec2-ice" id="come-lavoro">/,
    `<div class="srv2-grid">${gridHtml}</div>\n  <p style="margin-top:1.2rem"><a href="servizi/index.html" class="link-more">Tutti i servizi →</a></p>\n</section>\n\n<section class="sec2 sec2-ice" id="come-lavoro">`,
  );

  // zone2-grid — nascosto visivamente, resta nel codice per SEO
  const zoneGrid = buildZone2GridHome();
  if (!html.includes('id="zone" aria-hidden="true"')) {
    html = html.replace(
      /<section class="sec2" id="zone">/,
      '<section class="sec2 seo-only" id="zone" aria-hidden="true">',
    );
  }
  html = html.replace(
    /<div class="zone2-grid[^"]*">[\s\S]*?<\/div>(?=\s*\n\s*<p style="margin-top:1\.2rem"><a href="quartieri\/index\.html")/,
    `<div class="zone2-grid ${zoneGrid.gridClass}">${zoneGrid.items}</div>`,
  );
  if (!html.includes(SEO_ONLY_STYLE)) {
    html = html.replace('</head>', `  ${SEO_ONLY_STYLE}\n</head>`);
  }
  if (!html.includes('name="ICBM"')) {
    html = html.replace(
      /(<meta name="geo.position" content="45.4384;10.9916">)/,
      `$1\n  <meta name="ICBM" content="45.4384, 10.9916">`,
    );
  }

  write(indexPath, html);
}

async function main() {
  if (process.argv.includes('--perf-only')) {
    polishAllPages();
    console.log('Performance polish applied to all HTML pages.');
    return;
  }

  console.log('Gala 400 migration — OLD → V2');
  console.log(`OLD ref: ${OLD_REF} (GitHub ${GITHUB_OLD})`);
  console.log(`NEW: ${NEW_ROOT}`);

  if (!fs.existsSync(TEMPLATE)) {
    console.error('Template not found:', TEMPLATE);
    process.exit(1);
  }

  const tpl = loadTemplate();
  console.log('Template loaded (style, nav logo, contact2, footer, gtag).');

  for (const section of ['servizi', 'quartieri', 'marche']) {
    const n = await migrateSection(section, tpl);
    console.log(`  ${section}: ${n.length} pages`);
  }

  fixIndexListingPages();
  console.log('  index listing pages updated (servizi, quartieri, marche)');

  if (fs.existsSync(path.join(OLD_ROOT, 'sitemap.xml')) || fs.existsSync(path.join(OLD_REF, 'sitemap.xml')) || fs.existsSync(path.join(NEW_ROOT, 'sitemap.xml'))) {
    updateSitemap();
    console.log('  sitemap.xml updated');
  }

  updateIndex();
  console.log('  index.html updated');

  applyHreflangAll();
  console.log('  hreflang + ICBM applied to all pages');

  polishAllPages();
  console.log('  polish pass (cookieconsent dedupe, netlify detect)');

  console.log(`\nDone. Generated ${generated} HTML files.`);
  if (errors.length) {
    console.log(`Errors (${errors.length}):`);
    errors.forEach((e) => console.log('  -', e));
  }
}

main();
