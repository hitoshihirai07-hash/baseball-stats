window.CurrentPagesCommon = (function () {
  const TEAM_ORDER = [
    '読売ジャイアンツ','阪神タイガース','横浜DeNAベイスターズ','広島東洋カープ','中日ドラゴンズ','東京ヤクルトスワローズ',
    '福岡ソフトバンクホークス','北海道日本ハムファイターズ','オリックスバファローズ','埼玉西武ライオンズ','東北楽天ゴールデンイーグルス','千葉ロッテマリーンズ'
  ];

  const TEAM_ABBR = {
    '読売ジャイアンツ': '巨',
    '阪神タイガース': '神',
    '横浜DeNAベイスターズ': 'De',
    '広島東洋カープ': '広',
    '中日ドラゴンズ': '中',
    '東京ヤクルトスワローズ': 'ヤ',
    '福岡ソフトバンクホークス': 'ソ',
    '北海道日本ハムファイターズ': '日',
    'オリックス・バファローズ': 'オ',
    'オリックスバファローズ': 'オ',
    '埼玉西武ライオンズ': '西',
    '東北楽天ゴールデンイーグルス': '楽',
    '千葉ロッテマリーンズ': 'ロ'
  };

  function normalizeTeam(team) {
    const raw = String(team || '').trim();
    const map = {
      '巨人': '読売ジャイアンツ',
      '阪神': '阪神タイガース',
      'DeNA': '横浜DeNAベイスターズ',
      '横浜DeNA': '横浜DeNAベイスターズ',
      '広島': '広島東洋カープ',
      '中日': '中日ドラゴンズ',
      'ヤクルト': '東京ヤクルトスワローズ',
      'ソフトバンク': '福岡ソフトバンクホークス',
      '西武': '埼玉西武ライオンズ',
      '楽天': '東北楽天ゴールデンイーグルス',
      'ロッテ': '千葉ロッテマリーンズ',
      '日本ハム': '北海道日本ハムファイターズ',
      '日ハム': '北海道日本ハムファイターズ',
      'オリックス': 'オリックスバファローズ',
      'オリックス・バファローズ': 'オリックスバファローズ'
    };
    return map[raw] || raw;
  }

  function normalizeLoose(team) {
    return String(normalizeTeam(team) || '').replace(/[・･\s]/g, '');
  }

  function teamOrder(team) {
    const normalized = normalizeLoose(team);
    const idx = TEAM_ORDER.map(normalizeLoose).indexOf(normalized);
    return idx === -1 ? 999 : idx;
  }

  function teamBadge(team) {
    const label = TEAM_ABBR[team] || TEAM_ABBR[normalizeTeam(team)] || '球';
    return `<span class="team-badge">${label}</span>`;
  }

  function numberValue(value) {
    const cleaned = String(value || '').replace(/[^0-9]/g, '');
    if (!cleaned) return Number.MAX_SAFE_INTEGER;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  }

  function parseCSVLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map(v => v.trim());
  }

  async function loadCSV(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error('今年度データの読込に失敗しました');
    const text = await res.text();
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const header = parseCSVLine(lines[0]);
    return lines.slice(1).map(line => {
      const cols = parseCSVLine(line);
      const row = {};
      header.forEach((key, idx) => row[key] = cols[idx] ?? '');
      return row;
    });
  }

  function fillTeamSelect(select, teams, includeAllLabel = '全球団', preferred = '') {
    const normalizedPreferred = normalizeLoose(preferred);
    select.innerHTML = `<option value="">${includeAllLabel}</option>` + teams
      .sort((a, b) => teamOrder(a) - teamOrder(b) || String(a).localeCompare(String(b), 'ja'))
      .map(team => `<option value="${team}">${team}</option>`).join('');
    if (normalizedPreferred) {
      const target = [...select.options].find(opt => normalizeLoose(opt.value) === normalizedPreferred);
      if (target) select.value = target.value;
    }
  }

  function getTeamFromQuery() {
    const params = new URLSearchParams(location.search);
    return params.get('team') || '';
  }

  function updateTeamQuery(team) {
    const params = new URLSearchParams(location.search);
    if (team) params.set('team', team); else params.delete('team');
    const query = params.toString();
    history.replaceState(null, '', location.pathname + (query ? `?${query}` : ''));
  }

  function buildPageHref(path, team) {
    return path + (team ? `?team=${encodeURIComponent(team)}` : '');
  }

  function syncPageLinks(team) {
    document.querySelectorAll('[data-team-link]').forEach(el => {
      const path = el.getAttribute('data-team-link') || '';
      if (path) el.setAttribute('href', buildPageHref(path, team));
    });
  }

  return {
    TEAM_ORDER,
    normalizeTeam,
    normalizeLoose,
    teamOrder,
    teamBadge,
    numberValue,
    parseCSVLine,
    loadCSV,
    fillTeamSelect,
    getTeamFromQuery,
    updateTeamQuery,
    buildPageHref,
    syncPageLinks
  };
})();
