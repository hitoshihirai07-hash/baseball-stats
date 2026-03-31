(function () {
  const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020];
  const PATHS = {
    currentMaster: '/data/current_player_master.csv',
    currentBatter: '/2026stats_batter.csv',
    currentPitcher: '/2026stats_pitcher.csv',
    currentBatterLr: '/2026_batter_left_and_right_stats.csv',
    currentPitcherLr: '/pitcher_left_and_right.csv',
    historicalBatting: '/public-data/batting/all.json',
    historicalPitching: '/public-data/pitching/all.json',
    historicalBattingLr: '/data/batting_vs_lr.csv',
    historicalPitchingLr: '/data/pitching_vs_lr.csv'
  };

  const cache = {
    currentMaster: null,
    currentBatter: null,
    currentPitcher: null,
    currentBatterLr: null,
    currentPitcherLr: null,
    historicalBatting: null,
    historicalPitching: null,
    historicalBattingLr: null,
    historicalPitchingLr: null,
    promises: {}
  };

  function injectStyles() {
    if (document.getElementById('player-detail-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'player-detail-panel-styles';
    style.textContent = `
.player-link-btn{background:none;border:none;color:inherit;font:inherit;font-weight:800;cursor:pointer;padding:0;text-align:left}
.player-link-btn:hover{color:#fbbf24;text-decoration:underline}
.player-detail-wrap{display:none}
.player-detail-wrap.active{display:block}
.player-detail-head{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;margin-bottom:1rem}
.player-detail-name{font-size:clamp(1.25rem,3vw,1.8rem);font-weight:900;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}
.player-role-chip{display:inline-flex;align-items:center;justify-content:center;padding:.28rem .6rem;border-radius:999px;background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.3);color:#bfdbfe;font-size:.74rem;font-weight:800}
.player-detail-sub{display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.65rem}
.player-detail-chip{display:inline-flex;align-items:center;gap:.42rem;padding:.45rem .7rem;border-radius:999px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.22);color:#fcd34d;font-size:.8rem;font-weight:700}
.player-detail-chip span{color:#9ca3af;font-weight:600}
.player-detail-close{background:transparent;border:1px solid var(--bd);color:var(--tx);padding:.55rem .85rem;border-radius:10px;font-family:inherit;font-weight:700;cursor:pointer}
.player-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}
.player-detail-card{background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(17,24,39,.9));border:1px solid var(--bd);border-radius:14px;padding:1rem;min-width:0;overflow:hidden}
.player-detail-card h3,.player-detail-card h4{margin:0 0 .8rem;font-size:1rem;font-weight:800}
.player-detail-card h3::before,.player-detail-card h4::before{display:none}
.player-detail-card p{color:var(--tx2);font-size:.84rem;line-height:1.75}
.player-year-grid{display:grid;grid-template-columns:1fr;gap:1rem}
.player-year-grid > *{min-width:0}
.player-year-sections > *{min-width:0}
.tw{max-width:100%;overflow:auto}
.player-year-title{font-size:1rem;font-weight:900;margin-bottom:.8rem;color:#fbbf24}
.player-year-sections{display:grid;gap:.9rem}
.player-section-label{font-size:.82rem;font-weight:800;color:#d1d5db;margin-bottom:.45rem}
.player-empty{padding:.8rem 1rem;border:1px dashed var(--bd);border-radius:10px;color:var(--tx2);font-size:.84rem;background:rgba(17,24,39,.4)}
.player-mini-table{width:100%;border-collapse:collapse;min-width:0}
.player-mini-table th,.player-mini-table td{padding:.5rem .55rem;border-bottom:1px solid rgba(255,255,255,.08);white-space:nowrap;font-size:.82rem}
.player-mini-table th{font-size:.72rem;color:var(--tx2);text-align:left}
.player-mini-table tr:last-child td,.player-mini-table tr:last-child th{border-bottom:none}
.player-loading{color:var(--tx2);font-size:.9rem;padding:.6rem 0}
.player-error{color:#fca5a5;font-size:.9rem;padding:.6rem 0}
@media (max-width: 1080px){.player-detail-grid{grid-template-columns:1fr}}
`;
    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
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

  function parseCSV(text) {
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const header = parseCSVLine(lines[0]);
    return lines.slice(1).map(line => {
      const cols = parseCSVLine(line);
      const row = {};
      header.forEach((key, idx) => row[key] = cols[idx] ?? '');
      return row;
    });
  }

  async function loadText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('データの読み込みに失敗しました');
    return await res.text();
  }

  async function loadJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('データの読み込みに失敗しました');
    return await res.json();
  }

  function once(key, task) {
    if (cache.promises[key]) return cache.promises[key];
    cache.promises[key] = (async () => {
      try {
        return await task();
      } catch (error) {
        delete cache.promises[key];
        throw error;
      }
    })();
    return cache.promises[key];
  }

  function normalizeTeam(team) {
    const raw = String(team || '').trim();
    const map = {
      '巨人': '読売ジャイアンツ',
      '読売ジャイアンツ': '読売ジャイアンツ',
      '阪神': '阪神タイガース',
      '阪神タイガース': '阪神タイガース',
      'DeNA': '横浜DeNAベイスターズ',
      '横浜DeNA': '横浜DeNAベイスターズ',
      '横浜DeNAベイスターズ': '横浜DeNAベイスターズ',
      '広島': '広島東洋カープ',
      '広島東洋カープ': '広島東洋カープ',
      '中日': '中日ドラゴンズ',
      '中日ドラゴンズ': '中日ドラゴンズ',
      'ヤクルト': '東京ヤクルトスワローズ',
      '東京ヤクルトスワローズ': '東京ヤクルトスワローズ',
      'ソフトバンク': '福岡ソフトバンクホークス',
      '福岡ソフトバンクホークス': '福岡ソフトバンクホークス',
      '西武': '埼玉西武ライオンズ',
      '埼玉西武ライオンズ': '埼玉西武ライオンズ',
      '楽天': '東北楽天ゴールデンイーグルス',
      '東北楽天ゴールデンイーグルス': '東北楽天ゴールデンイーグルス',
      'ロッテ': '千葉ロッテマリーンズ',
      '千葉ロッテマリーンズ': '千葉ロッテマリーンズ',
      '日本ハム': '北海道日本ハムファイターズ',
      '日ハム': '北海道日本ハムファイターズ',
      '北海道日本ハムファイターズ': '北海道日本ハムファイターズ',
      'オリックス': 'オリックス・バファローズ',
      'オリックスバファローズ': 'オリックス・バファローズ',
      'オリックス・バファローズ': 'オリックス・バファローズ'
    };
    return map[raw] || raw;
  }

  function normalizeLooseTeam(team) {
    return normalizeTeam(team).replace(/[・･\s]/g, '');
  }

  function normalizeName(name) {
    return String(name || '').replace(/[\s　]/g, '').trim();
  }

  function sameName(a, b) {
    return normalizeName(a) && normalizeName(a) === normalizeName(b);
  }

  function sameTeam(a, b) {
    if (!a || !b) return false;
    return normalizeLooseTeam(a) === normalizeLooseTeam(b);
  }

  function teamBadge(team) {
    if (window.CurrentPagesCommon && typeof window.CurrentPagesCommon.teamBadge === 'function') {
      return window.CurrentPagesCommon.teamBadge(normalizeTeam(team));
    }
    return '';
  }

  function safeValue(value, fallback = '-') {
    const text = String(value ?? '').trim();
    return text || fallback;
  }

  function roleLabel(role) {
    return role === 'pitcher' ? '投手' : '野手';
  }

  async function ensureCurrentMaster() {
    if (Array.isArray(window.CURRENT_PLAYER_MASTER) && window.CURRENT_PLAYER_MASTER.length) {
      cache.currentMaster = window.CURRENT_PLAYER_MASTER;
      return cache.currentMaster;
    }
    if (cache.currentMaster) return cache.currentMaster;
    return once('currentMaster', async () => {
      const rows = parseCSV(await loadText(PATHS.currentMaster)).map(row => ({
        team: normalizeTeam(row['球団名']),
        no: String(row['No.'] || row['背番号'] || '').trim(),
        name: String(row['投手'] || row['選手名'] || '').trim(),
        birthDate: String(row['生年月日'] || '').trim(),
        height: String(row['身長'] || '').trim(),
        weight: String(row['体重'] || '').trim(),
        throwHand: String(row['投'] || '').trim(),
        batHand: String(row['打'] || '').trim(),
        note: String(row['備考'] || '').trim(),
        position: String(row['ポジション'] || '').trim(),
        division: String(row['区分'] || '').trim(),
        updatedAt: String(row['更新日'] || '').trim()
      })).filter(row => row.name && row.team);
      cache.currentMaster = rows;
      return rows;
    });
  }

  async function ensureCurrentSeason() {
    const existingPitcherLr = Array.isArray(window.CURRENT_SEASON_PITCHER_LR_STATS) && window.CURRENT_SEASON_PITCHER_LR_STATS.length;
    if (Array.isArray(window.CURRENT_SEASON_BATTER_STATS) && window.CURRENT_SEASON_BATTER_STATS.length && Array.isArray(window.CURRENT_SEASON_PITCHER_STATS) && window.CURRENT_SEASON_PITCHER_STATS.length && Array.isArray(window.CURRENT_SEASON_BATTER_LR_STATS) && window.CURRENT_SEASON_BATTER_LR_STATS.length && existingPitcherLr) {
      cache.currentBatter = window.CURRENT_SEASON_BATTER_STATS;
      cache.currentPitcher = window.CURRENT_SEASON_PITCHER_STATS;
      cache.currentBatterLr = window.CURRENT_SEASON_BATTER_LR_STATS;
      cache.currentPitcherLr = window.CURRENT_SEASON_PITCHER_LR_STATS;
      return;
    }
    if (cache.currentBatter && cache.currentPitcher && cache.currentBatterLr && cache.currentPitcherLr) return;
    return once('currentSeason', async () => {
      const [batterText, pitcherText, batterLrText, pitcherLrText] = await Promise.all([
        loadText(PATHS.currentBatter),
        loadText(PATHS.currentPitcher),
        loadText(PATHS.currentBatterLr),
        loadText(PATHS.currentPitcherLr)
      ]);
      cache.currentBatter = parseCSV(batterText).map(row => ({ ...row, team: normalizeTeam(row['チーム'] || row['球団']) })).filter(row => row['選手名']);
      cache.currentPitcher = parseCSV(pitcherText).map(row => ({ ...row, team: normalizeTeam(row['チーム'] || row['球団']) })).filter(row => row['選手名']);
      cache.currentBatterLr = parseCSV(batterLrText).map(row => ({ ...row, team: normalizeTeam(row['チーム'] || row['球団']) })).filter(row => row['選手名']);
      cache.currentPitcherLr = parseCSV(pitcherLrText).map(row => ({ ...row, team: normalizeTeam(row['チーム'] || row['球団']) })).filter(row => row['選手名']);
      window.CURRENT_SEASON_BATTER_STATS = cache.currentBatter;
      window.CURRENT_SEASON_PITCHER_STATS = cache.currentPitcher;
      window.CURRENT_SEASON_BATTER_LR_STATS = cache.currentBatterLr;
      window.CURRENT_SEASON_PITCHER_LR_STATS = cache.currentPitcherLr;
    });
  }

  async function ensureHistorical() {
    if (Array.isArray(window.BATTING_DATA) && window.BATTING_DATA.length && Array.isArray(window.PITCHING_DATA) && window.PITCHING_DATA.length && Array.isArray(window.BATTING_SPLIT_DATA) && window.BATTING_SPLIT_DATA.length && Array.isArray(window.PITCHING_SPLIT_DATA) && window.PITCHING_SPLIT_DATA.length) {
      cache.historicalBatting = window.BATTING_DATA.map(row => ({
        name: row[0], year: Number(row[1]), team: normalizeTeam(row[2]), games: row[3], avg: row[4], homeRuns: row[5], rbi: row[6], hits: row[7], steals: row[8], ops: row[9], obp: row[10], slg: row[11], pa: row[12]
      }));
      cache.historicalPitching = window.PITCHING_DATA.map(row => ({
        name: row[0], year: Number(row[1]), team: normalizeTeam(row[2]), games: row[3], wins: row[4], losses: row[5], saves: row[6], era: row[7], strikeouts: row[8], winPct: row[9], innings: row[10], holds: row[12]
      }));
      cache.historicalBattingLr = window.BATTING_SPLIT_DATA;
      cache.historicalPitchingLr = window.PITCHING_SPLIT_DATA;
      return;
    }
    if (cache.historicalBatting && cache.historicalPitching && cache.historicalBattingLr && cache.historicalPitchingLr) return;
    return once('historical', async () => {
      const [battingJson, pitchingJson, battingLrText, pitchingLrText] = await Promise.all([
        loadJSON(PATHS.historicalBatting),
        loadJSON(PATHS.historicalPitching),
        loadText(PATHS.historicalBattingLr),
        loadText(PATHS.historicalPitchingLr)
      ]);
      cache.historicalBatting = (battingJson.rows || []).map(row => ({
        name: row[0], year: Number(row[1]), team: normalizeTeam(row[2]), games: row[3], avg: row[4], homeRuns: row[5], rbi: row[6], hits: row[7], steals: row[8], ops: row[9], obp: row[10], slg: row[11], pa: row[12]
      }));
      cache.historicalPitching = (pitchingJson.rows || []).map(row => ({
        name: row[0], year: Number(row[1]), team: normalizeTeam(row[2]), games: row[3], wins: row[4], losses: row[5], saves: row[6], era: row[7], strikeouts: row[8], winPct: row[9], innings: row[10], holds: row[12]
      }));
      cache.historicalBattingLr = parseCSV(battingLrText).map(row => {
        const leftHits = Number(row['対左安打数'] || 0);
        const leftAb = Number(row['対左打数'] || 0);
        const rightHits = Number(row['対右安打数'] || 0);
        const rightAb = Number(row['対右打数'] || 0);
        return {
          name: row['選手名'],
          team: normalizeTeam(row['球団']),
          year: Number(row['年度']),
          position: row['ポジション'] || '',
          leftPaAb: row['対左打席数または打数'] || '',
          leftHits: row['対左安打数'] || '',
          leftAb: row['対左打数'] || '',
          leftAvg: leftAb > 0 ? leftHits / leftAb : null,
          rightPaAb: row['対右打席数または打数'] || '',
          rightHits: row['対右安打数'] || '',
          rightAb: row['対右打数'] || '',
          rightAvg: rightAb > 0 ? rightHits / rightAb : null
        };
      }).filter(row => row.name && row.year);
      cache.historicalPitchingLr = parseCSV(pitchingLrText).map(row => {
        const leftHits = Number(row['対左被安打'] || 0);
        const leftAb = Number(row['対被左打数'] || 0);
        const rightHits = Number(row['対右被安打'] || 0);
        const rightAb = Number(row['対被右打数'] || 0);
        return {
          name: row['選手名'],
          team: normalizeTeam(row['球団']),
          year: Number(row['年度']),
          position: row['ポジション'] || '',
          leftAb: row['対被左打数'] || '',
          leftHits: row['対左被安打'] || '',
          leftAvg: leftAb > 0 ? leftHits / leftAb : null,
          rightAb: row['対被右打数'] || '',
          rightHits: row['対右被安打'] || '',
          rightAvg: rightAb > 0 ? rightHits / rightAb : null
        };
      }).filter(row => row.name && row.year);
    });
  }

  function findBestTeamRow(rows, name, team) {
    const byName = rows.filter(row => sameName(row.name || row['選手名'], name));
    if (!byName.length) return null;
    if (team) {
      const exact = byName.find(row => sameTeam(row.team, team));
      if (exact) return exact;
    }
    return byName[0];
  }

  function findAllCurrentRows(rows, name, team) {
    return rows.filter(row => sameName(row['選手名'] || row.name, name) && (!team || sameTeam(row.team, team)));
  }

  function inferRole({ role, position, masterRow, batterOverall, pitcherOverall }) {
    if (role === 'pitcher' || role === 'batter') return role;
    const pos = String(position || masterRow?.position || '').trim();
    if (pos.includes('投')) return 'pitcher';
    if (pitcherOverall) return 'pitcher';
    if (batterOverall) return 'batter';
    return 'batter';
  }

  function formatRate(value, digits = 3) {
    if (value == null || value === '' || value === '-') return '-';
    const num = Number(value);
    return Number.isFinite(num) ? num.toFixed(digits) : escapeHtml(value);
  }

  function renderInfoChips(player) {
    const chips = [
      ['球団', player.team || '-'],
      ['背番号', player.no || '-'],
      ['ポジション', player.position || '-'],
      ['区分', player.division || '-'],
      ['生年月日', player.birthDate || '-'],
      ['身長', player.height ? `${player.height}cm` : '-'],
      ['体重', player.weight ? `${player.weight}kg` : '-'],
      ['投', player.throwHand || '-'],
      ['打', player.batHand || '-']
    ];
    return chips.map(([label, value]) => `<div class="player-detail-chip"><span>${escapeHtml(label)}</span>${escapeHtml(value)}</div>`).join('');
  }

  function renderEmpty(text = '成績表示なし') {
    return `<div class="player-empty">${escapeHtml(text)}</div>`;
  }

  function renderCurrentBatterOverall(row) {
    if (!row) return renderEmpty();
    return `<div class="tw"><table class="player-mini-table"><thead><tr><th>試合</th><th>打率</th><th>本塁打</th><th>打点</th><th>安打</th><th>盗塁</th><th>出塁率</th><th>長打率</th><th>OPS</th><th>打席</th></tr></thead><tbody><tr><td>${escapeHtml(safeValue(row['試合']))}</td><td>${escapeHtml(safeValue(row['打率']))}</td><td>${escapeHtml(safeValue(row['本塁打']))}</td><td>${escapeHtml(safeValue(row['打点']))}</td><td>${escapeHtml(safeValue(row['安打']))}</td><td>${escapeHtml(safeValue(row['盗塁']))}</td><td>${escapeHtml(safeValue(row['出塁率']))}</td><td>${escapeHtml(safeValue(row['長打率']))}</td><td>${escapeHtml(safeValue(row['OPS']))}</td><td>${escapeHtml(safeValue(row['打席']))}</td></tr></tbody></table></div>`;
  }

  function renderCurrentBatterLr(rows) {
    if (!rows.length) return renderEmpty();
    const order = { '対右': 0, '対左': 1 };
    const sorted = rows.slice().sort((a, b) => (order[a['区分']] ?? 9) - (order[b['区分']] ?? 9));
    return `<div class="tw"><table class="player-mini-table"><thead><tr><th>区分</th><th>打率</th><th>打数</th><th>安打</th><th>本塁打</th><th>打点</th><th>更新日</th></tr></thead><tbody>${sorted.map(row => `<tr><td>${escapeHtml(safeValue(row['区分']))}</td><td>${escapeHtml(safeValue(row['打率']))}</td><td>${escapeHtml(safeValue(row['打数']))}</td><td>${escapeHtml(safeValue(row['安打']))}</td><td>${escapeHtml(safeValue(row['本塁打']))}</td><td>${escapeHtml(safeValue(row['打点']))}</td><td>${escapeHtml(safeValue(row['更新日']))}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderCurrentPitcherOverall(row) {
    if (!row) return renderEmpty();
    return `<div class="tw"><table class="player-mini-table"><thead><tr><th>登板</th><th>勝利</th><th>敗戦</th><th>セーブ</th><th>ＨＰ</th><th>防御率</th><th>奪三振</th><th>勝率</th><th>投球回</th></tr></thead><tbody><tr><td>${escapeHtml(safeValue(row['登板']))}</td><td>${escapeHtml(safeValue(row['勝利']))}</td><td>${escapeHtml(safeValue(row['敗戦']))}</td><td>${escapeHtml(safeValue(row['セーブ']))}</td><td>${escapeHtml(safeValue(row['ＨＰ']))}</td><td>${escapeHtml(safeValue(row['防御率']))}</td><td>${escapeHtml(safeValue(row['奪三振']))}</td><td>${escapeHtml(safeValue(row['勝率']))}</td><td>${escapeHtml(safeValue(row['投球回']))}</td></tr></tbody></table></div>`;
  }

  function renderCurrentPitcherLr(rows) {
    if (!rows.length) return renderEmpty();
    const order = { '対右打者': 0, '対左打者': 1, '対右': 0, '対左': 1 };
    const sorted = rows.slice().sort((a, b) => (order[a['区分']] ?? 9) - (order[b['区分']] ?? 9));
    return `<div class="tw"><table class="player-mini-table"><thead><tr><th>区分</th><th>被打率</th><th>被打数</th><th>被安打</th><th>被本塁打</th><th>奪三振</th><th>与四球</th><th>与死球</th></tr></thead><tbody>${sorted.map(row => `<tr><td>${escapeHtml(safeValue(row['区分']))}</td><td>${escapeHtml(safeValue(row['被打率']))}</td><td>${escapeHtml(safeValue(row['被打数']))}</td><td>${escapeHtml(safeValue(row['被安打']))}</td><td>${escapeHtml(safeValue(row['被本塁打']))}</td><td>${escapeHtml(safeValue(row['奪三振']))}</td><td>${escapeHtml(safeValue(row['与四球']))}</td><td>${escapeHtml(safeValue(row['与死球']))}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderHistoricalBatterOverall(rows) {
    if (!rows.length) return renderEmpty();
    return `<div class="tw"><table class="player-mini-table"><thead><tr><th>球団</th><th>試合</th><th>打率</th><th>本塁打</th><th>打点</th><th>安打</th><th>盗塁</th><th>出塁率</th><th>長打率</th><th>OPS</th><th>打席</th></tr></thead><tbody>${rows.map(row => `<tr><td>${teamBadge(row.team)}${escapeHtml(row.team)}</td><td>${escapeHtml(safeValue(row.games))}</td><td>${escapeHtml(formatRate(row.avg))}</td><td>${escapeHtml(safeValue(row.homeRuns))}</td><td>${escapeHtml(safeValue(row.rbi))}</td><td>${escapeHtml(safeValue(row.hits))}</td><td>${escapeHtml(safeValue(row.steals))}</td><td>${escapeHtml(formatRate(row.obp))}</td><td>${escapeHtml(formatRate(row.slg))}</td><td>${escapeHtml(formatRate(row.ops))}</td><td>${escapeHtml(safeValue(row.pa))}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderHistoricalPitcherOverall(rows) {
    if (!rows.length) return renderEmpty();
    return `<div class="tw"><table class="player-mini-table"><thead><tr><th>球団</th><th>登板</th><th>勝利</th><th>敗戦</th><th>セーブ</th><th>ＨＰ</th><th>防御率</th><th>奪三振</th><th>勝率</th><th>投球回</th></tr></thead><tbody>${rows.map(row => `<tr><td>${teamBadge(row.team)}${escapeHtml(row.team)}</td><td>${escapeHtml(safeValue(row.games))}</td><td>${escapeHtml(safeValue(row.wins))}</td><td>${escapeHtml(safeValue(row.losses))}</td><td>${escapeHtml(safeValue(row.saves))}</td><td>${escapeHtml(safeValue(row.holds))}</td><td>${escapeHtml(formatRate(row.era,2))}</td><td>${escapeHtml(safeValue(row.strikeouts))}</td><td>${escapeHtml(formatRate(row.winPct,3))}</td><td>${escapeHtml(safeValue(row.innings))}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderHistoricalBatterLr(rows) {
    if (!rows.length) return renderEmpty();
    return `<div class="tw"><table class="player-mini-table"><thead><tr><th>球団</th><th>対左打席/打数</th><th>対左安打</th><th>対左打率</th><th>対右打席/打数</th><th>対右安打</th><th>対右打率</th></tr></thead><tbody>${rows.map(row => `<tr><td>${teamBadge(row.team)}${escapeHtml(row.team)}</td><td>${escapeHtml(safeValue(row.leftPaAb))}</td><td>${escapeHtml(safeValue(row.leftHits))}</td><td>${escapeHtml(formatRate(row.leftAvg))}</td><td>${escapeHtml(safeValue(row.rightPaAb))}</td><td>${escapeHtml(safeValue(row.rightHits))}</td><td>${escapeHtml(formatRate(row.rightAvg))}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderHistoricalPitcherLr(rows) {
    if (!rows.length) return renderEmpty();
    return `<div class="tw"><table class="player-mini-table"><thead><tr><th>球団</th><th>対被左打数</th><th>対左被安打</th><th>対左被打率</th><th>対被右打数</th><th>対右被安打</th><th>対右被打率</th></tr></thead><tbody>${rows.map(row => `<tr><td>${teamBadge(row.team)}${escapeHtml(row.team)}</td><td>${escapeHtml(safeValue(row.leftAb))}</td><td>${escapeHtml(safeValue(row.leftHits))}</td><td>${escapeHtml(formatRate(row.leftAvg))}</td><td>${escapeHtml(safeValue(row.rightAb))}</td><td>${escapeHtml(safeValue(row.rightHits))}</td><td>${escapeHtml(formatRate(row.rightAvg))}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderYearBlock(year, role, overallRows, splitRows) {
    const overallHtml = role === 'pitcher' ? renderHistoricalPitcherOverall(overallRows) : renderHistoricalBatterOverall(overallRows);
    const splitHtml = role === 'pitcher' ? renderHistoricalPitcherLr(splitRows) : renderHistoricalBatterLr(splitRows);
    return `<section class="player-detail-card"><div class="player-year-title">${year}年</div><div class="player-year-sections"><div><div class="player-section-label">全体</div>${overallRows.length ? overallHtml : renderEmpty()}</div><div><div class="player-section-label">対左右</div>${splitRows.length ? splitHtml : renderEmpty()}</div></div></section>`;
  }

  function buildPanelHtml(detail) {
    const currentOverallHtml = detail.role === 'pitcher' ? renderCurrentPitcherOverall(detail.currentPitcherOverall) : renderCurrentBatterOverall(detail.currentBatterOverall);
    const currentLrHtml = detail.role === 'pitcher' ? renderCurrentPitcherLr(detail.currentPitcherLr) : renderCurrentBatterLr(detail.currentBatterLr);
    return `
      <section class="card player-detail-wrap active" id="player-detail-card">
        <div class="player-detail-head">
          <div>
            <div class="player-detail-name">${teamBadge(detail.player.team)}${escapeHtml(detail.player.name)}<span class="player-role-chip">${escapeHtml(roleLabel(detail.role))}</span></div>
            <div class="player-detail-sub">${renderInfoChips(detail.player)}</div>
          </div>
          <button type="button" class="player-detail-close" id="player-detail-close-btn">閉じる</button>
        </div>
        <div class="player-detail-grid">
          <section class="player-detail-card">
            <h3>2026年 全体成績</h3>
            ${currentOverallHtml}
          </section>
          <section class="player-detail-card">
            <h3>2026年 対左右成績</h3>
            ${currentLrHtml}
          </section>
        </div>
        <div style="height:1rem"></div>
        <div class="player-year-grid">
          ${YEARS.filter(year => year <= 2025).map(year => renderYearBlock(year, detail.role, detail.historyOverallByYear[year] || [], detail.historyLrByYear[year] || [])).join('')}
        </div>
      </section>`;
  }

  async function buildDetail(payload) {
    await Promise.all([ensureCurrentMaster(), ensureCurrentSeason(), ensureHistorical()]);
    const currentMaster = cache.currentMaster || [];
    const currentBatter = cache.currentBatter || [];
    const currentPitcher = cache.currentPitcher || [];
    const currentBatterLr = cache.currentBatterLr || [];
    const currentPitcherLr = cache.currentPitcherLr || [];
    const historicalBatting = cache.historicalBatting || [];
    const historicalPitching = cache.historicalPitching || [];
    const historicalBattingLr = cache.historicalBattingLr || [];
    const historicalPitchingLr = cache.historicalPitchingLr || [];

    const inputTeam = normalizeTeam(payload.team || '');
    const inputName = String(payload.name || '').trim();
    const masterRow = findBestTeamRow(currentMaster, inputName, inputTeam);
    const currentBatterOverall = findBestTeamRow(currentBatter.map(row => ({ ...row, name: row['選手名'] })), inputName, inputTeam);
    const currentPitcherOverall = findBestTeamRow(currentPitcher.map(row => ({ ...row, name: row['選手名'] })), inputName, inputTeam);
    const role = inferRole({ role: payload.role, position: payload.position, masterRow, batterOverall: currentBatterOverall, pitcherOverall: currentPitcherOverall });
    const team = inputTeam || masterRow?.team || currentBatterOverall?.team || currentPitcherOverall?.team || '';

    const player = {
      team,
      name: inputName,
      no: payload.no || masterRow?.no || '',
      position: payload.position || masterRow?.position || (role === 'pitcher' ? '投手' : ''),
      division: payload.division || masterRow?.division || '',
      birthDate: payload.birthDate || masterRow?.birthDate || '',
      height: payload.height || masterRow?.height || '',
      weight: payload.weight || masterRow?.weight || '',
      throwHand: payload.throwHand || masterRow?.throwHand || '',
      batHand: payload.batHand || masterRow?.batHand || '',
      updatedAt: payload.updatedAt || masterRow?.updatedAt || ''
    };

    const currentBatterLrRows = role === 'batter' ? findAllCurrentRows(currentBatterLr, inputName, team) : [];
    const currentPitcherLrRows = role === 'pitcher' ? findAllCurrentRows(currentPitcherLr, inputName, team) : [];

    const historyOverallByYear = {};
    const historyLrByYear = {};
    YEARS.filter(year => year <= 2025).forEach(year => {
      if (role === 'pitcher') {
        historyOverallByYear[year] = historicalPitching.filter(row => row.year === year && sameName(row.name, inputName));
        historyLrByYear[year] = historicalPitchingLr.filter(row => row.year === year && sameName(row.name, inputName));
      } else {
        historyOverallByYear[year] = historicalBatting.filter(row => row.year === year && sameName(row.name, inputName));
        historyLrByYear[year] = historicalBattingLr.filter(row => row.year === year && sameName(row.name, inputName));
      }
    });

    return {
      player,
      role,
      currentBatterOverall: role === 'batter' ? currentBatterOverall : null,
      currentPitcherOverall: role === 'pitcher' ? currentPitcherOverall : null,
      currentBatterLr: currentBatterLrRows,
      currentPitcherLr: currentPitcherLrRows,
      historyOverallByYear,
      historyLrByYear
    };
  }

  function findHost() {
    return document.getElementById('player-detail-panel-host');
  }

  function showLoading() {
    const host = findHost();
    if (!host) return;
    host.innerHTML = `<section class="card player-detail-wrap active"><h2>選手詳細</h2><div class="player-loading">読込中...</div></section>`;
  }

  function showError(message) {
    const host = findHost();
    if (!host) return;
    host.innerHTML = `<section class="card player-detail-wrap active"><h2>選手詳細</h2><div class="player-error">${escapeHtml(message)}</div></section>`;
  }

  async function open(payload) {
    const host = findHost();
    if (!host || !payload?.name) return;
    injectStyles();
    showLoading();
    host.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const detail = await buildDetail(payload);
      host.innerHTML = buildPanelHtml(detail);
      const closeBtn = document.getElementById('player-detail-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          host.innerHTML = '';
        }, { once: true });
      }
    } catch (error) {
      showError(error.message || '読込に失敗しました');
    }
  }

  function readDataset(button) {
    return {
      name: button.dataset.name || '',
      team: button.dataset.team || '',
      role: button.dataset.role || '',
      position: button.dataset.position || '',
      no: button.dataset.no || '',
      division: button.dataset.division || '',
      birthDate: button.dataset.birthDate || '',
      height: button.dataset.height || '',
      weight: button.dataset.weight || '',
      throwHand: button.dataset.throwHand || '',
      batHand: button.dataset.batHand || '',
      updatedAt: button.dataset.updatedAt || ''
    };
  }

  injectStyles();

  document.addEventListener('click', function (event) {
    const button = event.target.closest('.player-detail-trigger');
    if (!button) return;
    event.preventDefault();
    open(readDataset(button));
  });

  window.PlayerDetailPanel = {
    open
  };
})();
