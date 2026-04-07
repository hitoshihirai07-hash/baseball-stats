(function () {
  const C = window.CurrentPagesCommon;
  if (!C) return;

  const LEAGUE_ORDER = ['セ・リーグ', 'パ・リーグ'];
  const state = {
    team: C.getTeamFromQuery() || '',
    search: '',
    standingsSections: [],
    teamMeta: new Map(),
    batters: [],
    pitchers: []
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function toNumber(value, fallback = 0) {
    const cleaned = String(value ?? '').replace(/[^0-9.\-]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : fallback;
  }

  function toAvgValue(value) {
    const text = String(value ?? '').trim();
    if (!text || text === '-' || text === '—') return -1;
    const n = Number(text);
    return Number.isFinite(n) ? n : -1;
  }

  function toEraValue(value) {
    const text = String(value ?? '').trim();
    if (!text || text === '-' || text === '—') return Number.MAX_SAFE_INTEGER;
    const n = Number(text);
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  }

  function parseInningsToOuts(value) {
    const text = String(value ?? '').trim();
    if (!text || text === '-' || text === '—') return 0;
    if (text.includes('/')) {
      const [whole, frac] = text.split('/');
      const wholeNum = Number(whole) || 0;
      const fracNum = Number(frac) || 1;
      return Math.round((wholeNum + (1 / fracNum)) * 3);
    }
    const match = text.match(/^(\d+)(?:\.(\d+))?$/);
    if (!match) {
      const maybe = Number(text);
      return Number.isFinite(maybe) ? Math.round(maybe * 3) : 0;
    }
    const whole = Number(match[1] || 0);
    const fracRaw = match[2] || '';
    const frac = Number(fracRaw || 0);
    if (fracRaw === '1' || fracRaw === '2') {
      return whole * 3 + frac;
    }
    return Math.round(Number(text) * 3);
  }

  function formatRange(values, suffix) {
    if (!values.length) return `- ${suffix}`;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return min === max ? `${min}${suffix}` : `${min}〜${max}${suffix}`;
  }

  function getLeagueLabel(team) {
    const meta = state.teamMeta.get(C.normalizeTeam(team));
    return meta ? meta.league : '';
  }

  function getTeamGames(team) {
    const meta = state.teamMeta.get(C.normalizeTeam(team));
    return meta ? meta.games : 0;
  }

  function getBatterThreshold(team) {
    return Math.ceil(getTeamGames(team) * 3.1);
  }

  function getPitcherThreshold(team) {
    return getTeamGames(team);
  }

  function isStandingsContinuationRow_(cols, hasPrevious) {
    if (!hasPrevious) return false;
    const trimmed = cols.map(v => String(v || '').trim());
    const first = trimmed[0] || '';
    if (!first) return false;
    if (/^\(\d+\)/.test(first)) return true;
    const nonEmpty = trimmed.filter(Boolean);
    return nonEmpty.length <= 2 && first.includes(',');
  }

  function normalizeContinuationValues_(cols) {
    let values = cols.map(v => String(v || '').trim()).filter(Boolean);
    if (values.length === 1 && values[0].includes(',')) {
      values = C.parseCSVLine(values[0]).map(v => String(v || '').trim()).filter(Boolean);
    }
    if (values.length >= 2 && /^\(\d+\)$/.test(values[0])) {
      values = [values[0] + ',' + values[1]].concat(values.slice(2));
    }
    return values;
  }

  function buildStandingsRows_(group) {
    const header = group[0].map(v => String(v || '').trim());
    const rows = [];
    let previous = null;
    group.slice(1).forEach(cols => {
      const trimmed = cols.map(v => String(v || '').trim());
      if (!trimmed.some(Boolean)) return;
      if (isStandingsContinuationRow_(trimmed, !!previous)) {
        const values = normalizeContinuationValues_(trimmed);
        if (values.length && previous) {
          const firstMatchupIndex = Math.max(0, header.findIndex(col => /^対|^交流戦$/.test(col)));
          let insertIndex = Math.max(Math.min(previous.rawLength, header.length), firstMatchupIndex);
          values.forEach(value => {
            if (insertIndex < header.length) previous.values[insertIndex++] = value;
          });
          previous.rawLength = insertIndex;
        }
        return;
      }
      const row = {
        values: header.map((_, idx) => trimmed[idx] || ''),
        rawLength: Math.min(trimmed.length, header.length)
      };
      rows.push(row);
      previous = row;
    });
    return rows.map(row => {
      const obj = {};
      header.forEach((key, idx) => obj[key] = row.values[idx] || '');
      return obj;
    });
  }

  async function loadStandingsSections() {
    const res = await fetch('/npb_2026standings.csv');
    if (!res.ok) throw new Error('順位表の読込に失敗しました');
    const text = await res.text();
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    const rawRows = lines.map(line => C.parseCSVLine(line));
    const groups = [];
    let current = [];
    rawRows.forEach(row => {
      const isBlank = row.every(v => !String(v || '').trim());
      if (isBlank) {
        if (current.length) { groups.push(current); current = []; }
      } else {
        current.push(row);
      }
    });
    if (current.length) groups.push(current);
    return groups.map(group => {
      const header = group[0].map(v => String(v || '').trim());
      const rows = buildStandingsRows_(group);
      const league = header.includes('対巨') ? 'セ・リーグ' : header.includes('対ソ') ? 'パ・リーグ' : '';
      return { league, header, rows };
    }).filter(section => section.header.length && section.rows.length);
  }

  function prepareRows() {
    state.batters = (window.CURRENT_SEASON_BATTER_STATS || []).map(row => {
      const team = C.normalizeTeam(row.team || row['チーム'] || row['球団'] || '');
      const games = getTeamGames(team);
      return {
        ...row,
        team,
        league: getLeagueLabel(team),
        qualifier: getBatterThreshold(team),
        plateAppearances: toNumber(row['打席']),
        avgValue: toAvgValue(row['打率']),
        opsValue: toAvgValue(row['OPS']),
        hitsValue: toNumber(row['安打']),
        teamGames: games,
        qualified: !!games && toNumber(row['打席']) >= getBatterThreshold(team)
      };
    }).filter(row => row['選手名'] && row.team && row.league);

    state.pitchers = (window.CURRENT_SEASON_PITCHER_STATS || []).map(row => {
      const team = C.normalizeTeam(row.team || row['チーム'] || row['球団'] || '');
      const games = getTeamGames(team);
      return {
        ...row,
        team,
        league: getLeagueLabel(team),
        qualifier: getPitcherThreshold(team),
        inningsOuts: parseInningsToOuts(row['投球回']),
        eraValue: toEraValue(row['防御率']),
        strikeoutsValue: toNumber(row['奪三振']),
        teamGames: games,
        qualified: !!games && parseInningsToOuts(row['投球回']) >= getPitcherThreshold(team) * 3
      };
    }).filter(row => row['選手名'] && row.team && row.league);
  }

  function currentSearch() {
    return String(state.search || '').replace(/[\s　]/g, '').toLowerCase();
  }

  function matchesFilters(row) {
    const selectedTeam = state.team || '';
    if (selectedTeam && C.normalizeLoose(row.team) !== C.normalizeLoose(selectedTeam)) return false;
    const needle = currentSearch();
    if (!needle) return true;
    const hay = String(row['選手名'] || '').replace(/[\s　]/g, '').toLowerCase();
    return hay.includes(needle);
  }

  function getQualifiedBatters(league) {
    return state.batters.filter(row => row.qualified && row.league === league && matchesFilters(row))
      .sort((a, b) => b.avgValue - a.avgValue || b.opsValue - a.opsValue || b.hitsValue - a.hitsValue || b.plateAppearances - a.plateAppearances || C.teamOrder(a.team) - C.teamOrder(b.team) || String(a['選手名']).localeCompare(String(b['選手名']), 'ja'));
  }

  function getQualifiedPitchers(league) {
    return state.pitchers.filter(row => row.qualified && row.league === league && matchesFilters(row))
      .sort((a, b) => a.eraValue - b.eraValue || b.inningsOuts - a.inningsOuts || b.strikeoutsValue - a.strikeoutsValue || C.teamOrder(a.team) - C.teamOrder(b.team) || String(a['選手名']).localeCompare(String(b['選手名']), 'ja'));
  }

  function buildPlayerButton(row, role) {
    return `<button class="player-link-btn player-detail-trigger" data-name="${escapeHtml(row['選手名'] || '')}" data-team="${escapeHtml(row.team || '')}" data-role="${role}">${escapeHtml(row['選手名'] || '')}</button>`;
  }

  function renderBatterTable(league, rows) {
    if (!rows.length) return '<div class="empty">条件に合う選手はいません。</div>';
    const body = rows.map((row, idx) => `
      <tr>
        <td class="rank">${idx + 1}</td>
        <td>${C.teamBadge(row.team)}${escapeHtml(row.team)}</td>
        <td>${buildPlayerButton(row, 'batter')}</td>
        <td>${escapeHtml(row['試合'] || '-')}</td>
        <td><strong>${escapeHtml(row['打率'] || '-')}</strong></td>
        <td>${escapeHtml(row['本塁打'] || '-')}</td>
        <td>${escapeHtml(row['打点'] || '-')}</td>
        <td>${escapeHtml(row['安打'] || '-')}</td>
        <td>${escapeHtml(row['OPS'] || '-')}</td>
        <td>${escapeHtml(row['打席'] || '-')}</td>
        <td class="muted">${row.qualifier}</td>
      </tr>`).join('');
    return `
      <div class="subsection-title">
        <h4>${league} 規定打席到達者</h4>
        <div class="small">打率順</div>
      </div>
      <div class="tw qualifier-table">
        <table>
          <thead><tr><th>#</th><th>球団</th><th>選手名</th><th>試合</th><th>打率</th><th>本塁打</th><th>打点</th><th>安打</th><th>OPS</th><th>打席</th><th>規定</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  }

  function renderPitcherTable(league, rows) {
    if (!rows.length) return '<div class="empty">条件に合う投手はいません。</div>';
    const body = rows.map((row, idx) => `
      <tr>
        <td class="rank">${idx + 1}</td>
        <td>${C.teamBadge(row.team)}${escapeHtml(row.team)}</td>
        <td>${buildPlayerButton(row, 'pitcher')}</td>
        <td>${escapeHtml(row['登板'] || '-')}</td>
        <td>${escapeHtml(row['勝利'] || '-')}</td>
        <td>${escapeHtml(row['敗戦'] || '-')}</td>
        <td>${escapeHtml(row['防御率'] || '-')}</td>
        <td>${escapeHtml(row['奪三振'] || '-')}</td>
        <td>${escapeHtml(row['投球回'] || '-')}</td>
        <td>${escapeHtml(row['勝率'] || '-')}</td>
        <td class="muted">${row.qualifier}</td>
      </tr>`).join('');
    return `
      <div class="subsection-title">
        <h4>${league} 規定投球回到達者</h4>
        <div class="small">防御率順</div>
      </div>
      <div class="tw qualifier-table">
        <table>
          <thead><tr><th>#</th><th>球団</th><th>選手名</th><th>登板</th><th>勝</th><th>敗</th><th>防御率</th><th>奪三振</th><th>投球回</th><th>勝率</th><th>規定</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  }

  function renderSummary() {
    const target = document.getElementById('qualified-summary-row');
    if (!target) return;
    const chips = [];
    const totalBatters = state.batters.filter(row => row.qualified && matchesFilters(row)).length;
    const totalPitchers = state.pitchers.filter(row => row.qualified && matchesFilters(row)).length;
    chips.push(`<div class="summary-chip">規定打席到達 ${totalBatters}人</div>`);
    chips.push(`<div class="summary-chip">規定投球回到達 ${totalPitchers}人</div>`);
    LEAGUE_ORDER.forEach(league => {
      const leagueTeams = [...state.teamMeta.values()].filter(meta => meta.league === league && (!state.team || C.normalizeLoose(meta.team) === C.normalizeLoose(state.team)));
      const batterThresholds = leagueTeams.map(meta => Math.ceil(meta.games * 3.1));
      const pitcherThresholds = leagueTeams.map(meta => meta.games);
      if (leagueTeams.length) {
        chips.push(`<div class="summary-chip">${league} 規定打席 ${formatRange(batterThresholds, '打席')}</div>`);
        chips.push(`<div class="summary-chip">${league} 規定投球回 ${formatRange(pitcherThresholds, '回')}</div>`);
      }
    });
    target.innerHTML = chips.join('');
  }

  function renderSections() {
    const target = document.getElementById('qualified-sections');
    if (!target) return;
    const html = LEAGUE_ORDER.map(league => {
      const leagueTeams = [...state.teamMeta.values()].filter(meta => meta.league === league && (!state.team || C.normalizeLoose(meta.team) === C.normalizeLoose(state.team)));
      if (!leagueTeams.length) return '';
      const qualifiedBatters = getQualifiedBatters(league);
      const qualifiedPitchers = getQualifiedPitchers(league);
      const batterThresholds = leagueTeams.map(meta => Math.ceil(meta.games * 3.1));
      const pitcherThresholds = leagueTeams.map(meta => meta.games);
      return `
        <section class="card league-card">
          <div class="league-title">
            <h3>${league}</h3>
            <div class="rule-box">
              <div class="rule-chip">規定打席 ${formatRange(batterThresholds, '打席')}</div>
              <div class="rule-chip">規定投球回 ${formatRange(pitcherThresholds, '回')}</div>
              <div class="rule-chip">野手 ${qualifiedBatters.length}人</div>
              <div class="rule-chip">投手 ${qualifiedPitchers.length}人</div>
            </div>
          </div>
          <div class="league-subgrid">
            ${renderBatterTable(league, qualifiedBatters)}
            ${renderPitcherTable(league, qualifiedPitchers)}
          </div>
        </section>`;
    }).filter(Boolean).join('');
    target.innerHTML = html || '<section class="card"><div class="empty">条件に合うデータがありません。</div></section>';
  }

  function fillTeamFilter() {
    const teams = [...state.teamMeta.values()].map(meta => meta.team);
    const select = document.getElementById('cq-team');
    if (!select) return;
    C.fillTeamSelect(select, teams, '全球団', state.team || '');
    if (state.team) {
      const matched = [...select.options].find(opt => C.normalizeLoose(opt.value) === C.normalizeLoose(state.team));
      if (matched) select.value = matched.value;
    }
  }

  function bind() {
    const teamSelect = document.getElementById('cq-team');
    const searchInput = document.getElementById('cq-search');
    if (teamSelect) {
      teamSelect.addEventListener('change', () => {
        state.team = teamSelect.value || '';
        C.updateTeamQuery(state.team);
        C.syncPageLinks(state.team);
        renderSummary();
        renderSections();
      });
    }
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        state.search = searchInput.value || '';
        renderSummary();
        renderSections();
      });
    }
  }

  async function init() {
    try {
      state.standingsSections = await loadStandingsSections();
      state.teamMeta = new Map();
      state.standingsSections.forEach(section => {
        section.rows.forEach(row => {
          const team = C.normalizeTeam(row['チーム'] || '');
          const games = toNumber(row['試合']);
          if (team && games) state.teamMeta.set(team, { team, league: section.league, games });
        });
      });
      await window.CurrentSeasonStatsStore.ensure();
      prepareRows();
      fillTeamFilter();
      C.syncPageLinks(state.team);
      bind();
      renderSummary();
      renderSections();
    } catch (error) {
      const target = document.getElementById('qualified-sections');
      if (target) {
        target.innerHTML = `<section class="card"><div class="empty">${escapeHtml(error.message || '読込に失敗しました')}</div></section>`;
      }
    }
  }

  init();
})();
