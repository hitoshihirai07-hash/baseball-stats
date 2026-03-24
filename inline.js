
        // ============================================================
        // TEAM META
        // ============================================================
        const TM = {
            '読売ジャイアンツ': { tag: 'giants', l: 'セ', sn: '巨人' },
            '阪神タイガース': { tag: 'tigers', l: 'セ', sn: '阪神' },
            '中日ドラゴンズ': { tag: 'dragons', l: 'セ', sn: '中日' },
            '広島東洋カープ': { tag: 'carp', l: 'セ', sn: '広島' },
            '東京ヤクルトスワローズ': { tag: 'swallows', l: 'セ', sn: 'ヤクルト' },
            '横浜DeNAベイスターズ': { tag: 'baystars', l: 'セ', sn: 'DeNA' },
            '福岡ソフトバンクホークス': { tag: 'hawks', l: 'パ', sn: 'ソフトバンク' },
            '埼玉西武ライオンズ': { tag: 'lions', l: 'パ', sn: '西武' },
            '東北楽天ゴールデンイーグルス': { tag: 'eagles', l: 'パ', sn: '楽天' },
            '千葉ロッテマリーンズ': { tag: 'marines', l: 'パ', sn: 'ロッテ' },
            '北海道日本ハムファイターズ': { tag: 'fighters', l: 'パ', sn: '日ハム' },
            'オリックスバファローズ': { tag: 'buffaloes', l: 'パ', sn: 'オリックス' },
            'オリックス・バファローズ': { tag: 'buffaloes', l: 'パ', sn: 'オリックス' },
        };
        function tleague(name) { return TM[name]?.l; } // Tag helper
        function ttag(name) {
            if (!name) return `<span class="t-badge giants">不明</span>`;
            const clean = name.replace(/[\n\r\s・"']/g, "").replace(/\(.*\)/, "");

            // TMから検索
            let t = TM[name] || TM[clean];
            if (!t) {
                // 部分一致や略称での検索
                const entry = Object.entries(TM).find(([k, v]) =>
                    clean.includes(k) || k.includes(clean) || clean.includes(v.sn) || v.sn.includes(clean)
                );
                if (entry) t = entry[1];
            }

            const team = t || { tag: 'giants', sn: '不明' };
            const badgeClass = t ? team.tag : 'giants';
            const badgeName = t ? team.sn : (name.length > 4 ? name.substring(0, 3) : name);

            return `<span class="t-badge ${badgeClass}">${badgeName}</span>`;
        }

        function sn(name) {
            return TM[name]?.sn || name;
        }

        function getResolvedNipponSeriesWinners() {
            const fallback = window.NIPPON_SERIES_WINNERS || {};
            const rows = Array.isArray(TEAM_DATA) ? TEAM_DATA : [];
            const hasExplicitChampion = rows.some(d => d && d.nippon === '○');
            return rows.map(d => {
                if (!d || typeof d !== 'object') return d;
                if (hasExplicitChampion) return d;
                return {
                    ...d,
                    nippon: fallback[Number(d.year)] === d.team ? '○' : (d.nippon || '-')
                };
            });
        }

        // DATA HOLDERS (Initialized for sync logic)
        window.BATTING_DATA = window.BATTING_DATA || [];
        window.PITCHING_DATA = window.PITCHING_DATA || [];
        window.TEAM_DATA = window.TEAM_DATA || [];
        window.ORDER_DATA = window.ORDER_DATA || [];
        window.ORDER_TOP3 = window.ORDER_TOP3 || {};
        window.SITE_SUMMARY = window.SITE_SUMMARY || null;

        // STATE
        let bF = [], pF = [], tF = [];
        let bsF = [], psF = [];
        let bPage = 1, pPage = 1, tPage = 1, bsPage = 1, psPage = 1;
        let bSort = { c: -1, asc: false }, pSort = { c: -1, asc: false }, tSort = { c: -1, asc: false };
        let bsSort = { key: '', asc: false }, psSort = { key: '', asc: false };

        // ============================================================
        // INIT: build year/team dropdowns
        // ============================================================
        function initDropdowns() {
            const selectIds = ['by', 'bt', 'py', 'pt', 'ty', 'tt', 'oy', 'ot'];
            const prev = {};
            selectIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) prev[id] = el.value;
            });

            const reset = id => {
                const el = document.getElementById(id);
                if (!el) return null;
                const first = el.options[0] ? el.options[0].cloneNode(true) : null;
                el.innerHTML = '';
                if (first) el.appendChild(first);
                return el;
            };

            const years = [...new Set(BATTING_DATA.map(d => d[1]))].sort((a, b) => b - a);
            const batTeams = [...new Set(BATTING_DATA.map(d => d[2]))].sort();
            const pitTeams = [...new Set(PITCHING_DATA.map(d => d[2]))].sort();
            const tTeams = [...new Set(TEAM_DATA.map(d => d.team))].sort();
            const tyears = [...new Set(TEAM_DATA.map(d => d.year))].sort((a, b) => b - a);
            const pyears = [...new Set(PITCHING_DATA.map(d => d[1]))].sort((a, b) => b - a);
            const oyears = ORDER_DATA.length
                ? [...new Set(ORDER_DATA.map(d => d[0]))].sort((a, b) => b - a)
                : [...(window.SITE_SUMMARY?.years || [])].sort((a, b) => b - a);
            const oTeams = ORDER_DATA.length
                ? [...new Set(ORDER_DATA.map(d => d[2]))].sort()
                : [...(window.SITE_SUMMARY?.teams || [])].sort();

            function fill(id, items) {
                const s = reset(id);
                if (!s) return;
                items.forEach(v => {
                    const o = document.createElement('option');
                    o.value = v;
                    o.textContent = v;
                    s.appendChild(o);
                });
                if (prev[id] && [...s.options].some(o => o.value === prev[id])) {
                    s.value = prev[id];
                }
            }

            fill('by', years); fill('bt', batTeams);
            fill('py', pyears); fill('pt', pitTeams);
            fill('ty', tyears); fill('tt', tTeams);
            fill('oy', oyears); fill('ot', oTeams);
        }

        function updateHomeCounts() {
            const rows = window.CURRENT_PLAYER_MASTER || [];
            const total = rows.length;
            const registered = rows.filter(row => row.division === '支配下').length;
            const development = rows.filter(row => row.division === '育成').length;
            const set = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            };
            set('home-master-count', total ? total + '人' : '-');
            set('home-registered-count', total ? registered + '人' : '-');
            set('home-development-count', total ? development + '人' : '-');
        }

        // ============================================================
        // CURRENT MASTER
        // ============================================================
        const currentMasterState = {
            page: 1
        };

        function currentTeamOrder(name) {
            const order = [
                '読売ジャイアンツ',
                '阪神タイガース',
                '横浜DeNAベイスターズ',
                '広島東洋カープ',
                '中日ドラゴンズ',
                '東京ヤクルトスワローズ',
                '福岡ソフトバンクホークス',
                '北海道日本ハムファイターズ',
                'オリックスバファローズ',
                '埼玉西武ライオンズ',
                '東北楽天ゴールデンイーグルス',
                '千葉ロッテマリーンズ'
            ];
            const idx = order.indexOf(name);
            return idx === -1 ? 999 : idx;
        }

        function currentNumberValue(value) {
            const cleaned = String(value || '').replace(/[^0-9]/g, '');
            if (!cleaned) return Number.MAX_SAFE_INTEGER;
            const n = Number(cleaned);
            return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
        }

        function initCurrentMasterFilters() {
            const rows = window.CURRENT_PLAYER_MASTER || [];
            const teamSel = document.getElementById('cy-team');
            const posSel = document.getElementById('cy-position');
            if (!teamSel || !posSel) return;

            const prevTeam = teamSel.value;
            const prevPos = posSel.value;
            const teams = [...new Set(rows.map(row => row.team))].sort((a, b) => currentTeamOrder(a) - currentTeamOrder(b) || a.localeCompare(b, 'ja'));
            const positions = [...new Set(rows.map(row => row.position).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'));

            teamSel.innerHTML = '<option value="">全球団</option>' + teams.map(team => `<option value="${team}">${team}</option>`).join('');
            posSel.innerHTML = '<option value="">全ポジション</option>' + positions.map(pos => `<option value="${pos}">${pos}</option>`).join('');

            if ([...teamSel.options].some(opt => opt.value === prevTeam)) teamSel.value = prevTeam;
            if ([...posSel.options].some(opt => opt.value === prevPos)) posSel.value = prevPos;
        }

        function renderCurrentMaster(resetPage = false) {
            const body = document.getElementById('current-master-body');
            const pager = document.getElementById('current-master-pagination');
            const note = document.getElementById('current-master-note');
            if (!body || !pager || !note) return;

            if (resetPage) currentMasterState.page = 1;

            const rows = [...(window.CURRENT_PLAYER_MASTER || [])];
            const team = document.getElementById('cy-team')?.value || '';
            const division = document.getElementById('cy-division')?.value || '';
            const position = document.getElementById('cy-position')?.value || '';
            const keyword = (document.getElementById('cy-search')?.value || '').trim().toLowerCase();
            const limit = Number(document.getElementById('cy-limit')?.value || 50);

            const filtered = rows
                .filter(row => !team || row.team === team)
                .filter(row => !division || row.division === division)
                .filter(row => !position || row.position === position)
                .filter(row => {
                    if (!keyword) return true;
                    return row.name.toLowerCase().includes(keyword) || row.no.toLowerCase().includes(keyword);
                })
                .sort((a, b) => {
                    const teamDiff = currentTeamOrder(a.team) - currentTeamOrder(b.team);
                    if (teamDiff !== 0) return teamDiff;
                    const divisionDiff = (a.division === '支配下' ? 0 : 1) - (b.division === '支配下' ? 0 : 1);
                    if (divisionDiff !== 0) return divisionDiff;
                    const positionDiff = String(a.position).localeCompare(String(b.position), 'ja');
                    if (positionDiff !== 0) return positionDiff;
                    const numberDiff = currentNumberValue(a.no) - currentNumberValue(b.no);
                    if (numberDiff !== 0) return numberDiff;
                    return String(a.name).localeCompare(String(b.name), 'ja');
                });

            const total = filtered.length;
            const registered = filtered.filter(row => row.division === '支配下').length;
            const development = filtered.filter(row => row.division === '育成').length;
            note.textContent = total
                ? `${total}件を表示中（支配下 ${registered} / 育成 ${development}）`
                : '該当する選手がありません。';

            const perPage = limit === 9999 ? total || 1 : limit;
            const totalPages = Math.max(1, Math.ceil(Math.max(total, 1) / perPage));
            if (currentMasterState.page > totalPages) currentMasterState.page = totalPages;
            const start = (currentMasterState.page - 1) * perPage;
            const pageRows = filtered.slice(start, start + perPage);

            body.innerHTML = pageRows.length ? pageRows.map((row, idx) => `
                <tr>
                    <td>${start + idx + 1}</td>
                    <td>${ttag(row.team)} ${row.team}</td>
                    <td>${row.division || '-'}</td>
                    <td>${row.no || '-'}</td>
                    <td><b>${row.name}</b></td>
                    <td>${row.position || '-'}</td>
                    <td>${row.birthDate || '-'}</td>
                    <td>${row.height || '-'}</td>
                    <td>${row.weight || '-'}</td>
                    <td>${row.throwHand || '-'}</td>
                    <td>${row.batHand || '-'}</td>
                    <td>${row.note || '-'}</td>
                    <td>${row.updatedAt || '-'}</td>
                </tr>`).join('') : '<tr><td colspan="13" style="text-align:center;color:var(--tx2)">該当データがありません</td></tr>';

            pager.innerHTML = totalPages <= 1 ? '' : `
                <button ${currentMasterState.page === 1 ? 'disabled' : ''} onclick="changeCurrentMasterPage(-1)">← 前へ</button>
                <span>${currentMasterState.page} / ${totalPages}</span>
                <button ${currentMasterState.page === totalPages ? 'disabled' : ''} onclick="changeCurrentMasterPage(1)">次へ →</button>`;
        }

        function changeCurrentMasterPage(diff) {
            currentMasterState.page = Math.max(1, currentMasterState.page + diff);
            renderCurrentMaster();
        }

        // ============================================================
        // SIMULATOR LOGIC
        // ============================================================
        let curBS = null, curPS = null;
        let simBatCandidates = [], simPitCandidates = [];

        function upSimB() {
            const y = document.getElementById('sb-y').value;
            const t = document.getElementById('sb-t').value;
            const s = document.getElementById('sb-s').value.trim().toLowerCase();
            const list = BATTING_DATA.filter(d =>
                (!y || String(d[1]) === y) &&
                (!t || d[2] === t) &&
                (!s || d[0].toLowerCase().includes(s))
            ).slice(0, 50);
            simBatCandidates = list;
            document.getElementById('sb-l').innerHTML = list.map((d, i) =>
                `<div class="sim-item ${curBS && curBS[0] === d[0] && curBS[1] === d[1] ? 'active' : ''}" onclick='selSimBByIndex(${i})'>${d[0]} (${d[1]} ${TM[d[2]]?.sn || d[2]})</div>`
            ).join('');
        }

        function upSimP() {
            const y = document.getElementById('sp-y').value;
            const t = document.getElementById('sp-t').value;
            const s = document.getElementById('sp-s').value.trim().toLowerCase();
            const list = PITCHING_DATA.filter(d =>
                (!y || String(d[1]) === y) &&
                (!t || d[2] === t) &&
                (!s || d[0].toLowerCase().includes(s))
            ).slice(0, 50);
            simPitCandidates = list;
            document.getElementById('sp-l').innerHTML = list.map((d, i) =>
                `<div class="sim-item ${curPS && curPS[0] === d[0] && curPS[1] === d[1] ? 'active' : ''}" onclick='selSimPByIndex(${i})'>${d[0]} (${d[1]} ${TM[d[2]]?.sn || d[2]})</div>`
            ).join('');
        }

        window.selSimBByIndex = i => { const d = simBatCandidates[i]; if (!d) return; curBS = d; document.getElementById('sb-sel').textContent = `${d[0]} (${d[1]})`; upSimB(); checkSim(); };
        window.selSimPByIndex = i => { const d = simPitCandidates[i]; if (!d) return; curPS = d; document.getElementById('sp-sel').textContent = `${d[0]} (${d[1]})`; upSimP(); checkSim(); };

        window.importData = function(type, input) {
            if (typeof window.handleDataImport === 'function') return window.handleDataImport(type, input);
            if (typeof window.importTableData === 'function') return window.importTableData(type, input);
            if (typeof window.importFileData === 'function') return window.importFileData(type, input);
            if (typeof window.importDataFile === 'function') return window.importDataFile(type, input);
        };

        function checkSim() {
            const btn = document.getElementById('sim-run-btn');
            const note = document.getElementById('sim-split-note');
            const batAuto = document.getElementById('sim-bat-side-auto');
            const pitAuto = document.getElementById('sim-pit-hand-auto');
            if (curBS && curPS) {
                btn.disabled = false;
                const pitHand = getPitcherThrowHand(curPS);
                const batSide = getBatterSideForMatchup(curBS, pitHand);
                if (batAuto) batAuto.textContent = handLabel(batSide, 'bat');
                if (pitAuto) pitAuto.textContent = handLabel(pitHand);
                document.getElementById('sim-vs-names').textContent = `${curBS[0]} (${handLabel(batSide, 'bat')}) vs ${curPS[0]} (${handLabel(pitHand)})`;
                document.getElementById('sim-vs').style.opacity = "1";
                if (note) {
                    if (pitHand && batSide) {
                        note.textContent = `打者は対${pitHand === 'L' ? '左' : '右'}、投手は対${batSide === 'L' ? '左' : '右'}打者成績で補正します。`;
                    } else if (pitHand) {
                        note.textContent = '投手の投球左右は自動判定できています。打者の打席左右が見つからないため、投手側は通常成績で計算します。';
                    } else {
                        note.textContent = '投打情報が見つからないため、通常成績ベースで計算します。';
                    }
                }
            } else {
                btn.disabled = true;
                if (batAuto) batAuto.textContent = '選手データから自動判定';
                if (pitAuto) pitAuto.textContent = '選手データから自動判定';
                if (note) note.textContent = '';
            }
        }

        function runSim() {
            if (!curBS || !curPS) return;
            document.getElementById('sim-res').style.display = 'block';

            const L_AVG = 0.250, L_HR = 0.025, L_K = 0.180;
            const pitHand = getPitcherThrowHand(curPS);
            const batSide = getBatterSideForMatchup(curBS, pitHand);
            const batterMetrics = getAdjustedBatterMetrics(curBS, pitHand);
            const pitcherMetrics = getAdjustedPitcherMetrics(curPS, batSide);

            const calc = (b, p, l) => {
                const res = (b * p / l) / ((b * p / l) + ((1 - b) * (1 - p) / (1 - l)));
                return Math.max(0, Math.min(1, res));
            };

            const batterKBase = clampNumber(0.15 * (L_AVG / Math.max(batterMetrics.avg, 0.140)), 0.080, 0.280);
            const probH = calc(batterMetrics.avg, pitcherMetrics.avgAllowed, L_AVG);
            const probHR = calc(batterMetrics.hrRate, pitcherMetrics.hrRate, L_HR);
            const probK = calc(batterKBase, pitcherMetrics.kRate, L_K);

            const render = (id, val) => {
                const p = (val * 100).toFixed(1);
                document.getElementById('bv-' + id).textContent = p + '%';
                document.getElementById('br-' + id).style.width = p + '%';
            };

            render('h', probH);
            render('hr', probHR);
            render('k', probK);

            const win = probH > 0.280 || probHR > 0.05 ? "打者有利" : probH < 0.220 ? "投手有利" : "互角の攻防";
            const sourceText = `${batterMetrics.adjusted ? batterMetrics.label : '打者通常'} / ${pitcherMetrics.adjusted ? pitcherMetrics.label : '投手通常'}`;
            document.getElementById('sim-win').innerHTML = `予測結果: ${win}<div style="margin-top:.5rem;font-size:.82rem;color:var(--tx2);font-weight:700;">${sourceText}</div>`;
        }


        function toNumberSafe(v) {
            if (v == null || v === '') return null;
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
        }

        function fmtRate(v) {
            return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(3) : '-';
        }

        function fmtCount(v) {
            return typeof v === 'number' && Number.isFinite(v) ? v : '-';
        }

        function diffClass(v) {
            if (typeof v !== 'number' || !Number.isFinite(v)) return 'split-stat-even';
            if (v > 0) return 'split-stat-plus';
            if (v < 0) return 'split-stat-minus';
            return 'split-stat-even';
        }

        function diffText(v) {
            if (typeof v !== 'number' || !Number.isFinite(v)) return '-';
            return (v > 0 ? '+' : '') + v.toFixed(3);
        }

        let battingSplitLookup = null;
        let pitchingSplitLookup = null;

        function clampNumber(value, min, max) {
            const n = Number(value);
            if (!Number.isFinite(n)) return min;
            return Math.max(min, Math.min(max, n));
        }

        function ensureBattingSplitLookup() {
            const rows = window.BATTING_SPLIT_DATA || [];
            if (!rows.length) return null;
            if (!battingSplitLookup || battingSplitLookup.size !== rows.length) {
                battingSplitLookup = new Map(rows.map(row => [`${row.name}|${row.year}|${row.team}`, row]));
            }
            return battingSplitLookup;
        }

        function ensurePitchingSplitLookup() {
            const rows = window.PITCHING_SPLIT_DATA || [];
            if (!rows.length) return null;
            if (!pitchingSplitLookup || pitchingSplitLookup.size !== rows.length) {
                pitchingSplitLookup = new Map(rows.map(row => [`${row.name}|${row.year}|${row.team}`, row]));
            }
            return pitchingSplitLookup;
        }

        function getBattingSplitRow(masterRow) {
            if (!masterRow) return null;
            const map = ensureBattingSplitLookup();
            if (!map) return null;
            return map.get(`${masterRow[0]}|${masterRow[1]}|${masterRow[2]}`) || null;
        }

        function getPitchingSplitRow(masterRow) {
            if (!masterRow) return null;
            const map = ensurePitchingSplitLookup();
            if (!map) return null;
            return map.get(`${masterRow[0]}|${masterRow[1]}|${masterRow[2]}`) || null;
        }

        function normalizeHandCode(value, type = 'pit') {
            const raw = String(value || '').trim();
            if (!raw) return null;
            if (['L', '左', '左打', '左投'].includes(raw)) return 'L';
            if (['R', '右', '右打', '右投'].includes(raw)) return 'R';
            if (type === 'bat' && ['S', '両', '両打', 'スイッチ'].includes(raw)) return 'S';
            return null;
        }

        function handLabel(hand, type = 'pit') {
            if (type === 'bat') {
                if (hand === 'L') return '左打席';
                if (hand === 'R') return '右打席';
                if (hand === 'S') return '両打';
                return '不明';
            }
            if (hand === 'L') return '左投手';
            if (hand === 'R') return '右投手';
            return '不明';
        }

        function getHandednessRecord(masterRow) {
            if (!masterRow || !window.HandednessStore || typeof window.HandednessStore.get !== 'function') return null;
            return window.HandednessStore.get(masterRow[0], masterRow[2]) || null;
        }

        function getPitcherThrowHand(masterRow) {
            const rec = getHandednessRecord(masterRow);
            return normalizeHandCode(rec?.pitchHand, 'pit');
        }

        function resolveBatterSide(batHand, pitcherHand) {
            const code = normalizeHandCode(batHand, 'bat');
            if (code === 'S') {
                if (pitcherHand === 'L') return 'R';
                if (pitcherHand === 'R') return 'L';
                return 'S';
            }
            return code;
        }

        function getBatterSideForMatchup(masterRow, pitcherHand) {
            const rec = getHandednessRecord(masterRow);
            return resolveBatterSide(rec?.batHand, pitcherHand);
        }

        function getAdjustedBatterMetrics(bData, pitcherHand) {
            const seasonAvg = clampNumber(bData?.[4] ?? 0.250, 0.120, 0.450);
            const seasonObp = clampNumber(bData?.[10] ?? Math.max(seasonAvg, 0.300), 0.180, 0.520);
            const seasonSlg = clampNumber(bData?.[11] ?? Math.max(seasonAvg * 1.45, 0.320), 0.180, 0.850);
            const seasonPa = Math.max(1, Number(bData?.[12] || 0));
            const seasonHrRate = clampNumber((Number(bData?.[5] || 0) / seasonPa), 0.002, 0.120);
            const splitRow = getBattingSplitRow(bData);
            const useHand = pitcherHand === 'L' || pitcherHand === 'R' ? pitcherHand : null;
            const splitAvg = splitRow && useHand ? (useHand === 'L' ? splitRow.leftAvg : splitRow.rightAvg) : null;
            const splitAb = splitRow && useHand ? (useHand === 'L' ? splitRow.leftAb : splitRow.rightAb) : null;
            const splitPa = splitRow && useHand ? (useHand === 'L' ? splitRow.leftPaAb : splitRow.rightPaAb) : null;
            if (typeof splitAvg === 'number' && Number.isFinite(splitAvg)) {
                const ratio = clampNumber(splitAvg / Math.max(seasonAvg, 0.180), 0.72, 1.32);
                return {
                    avg: splitAvg,
                    obp: clampNumber(seasonObp * ratio, 0.180, 0.520),
                    slg: clampNumber(seasonSlg * ratio, 0.180, 0.850),
                    hrRate: clampNumber(seasonHrRate * (0.85 + (ratio - 1) * 1.2), 0.002, 0.120),
                    paLike: Number.isFinite(splitPa) && splitPa > 0 ? splitPa : seasonPa,
                    abLike: Number.isFinite(splitAb) && splitAb > 0 ? splitAb : seasonPa * 0.9,
                    adjusted: true,
                    splitAvg,
                    label: `対${useHand === 'L' ? '左' : '右'} ${fmtRate(splitAvg)}`
                };
            }
            return {
                avg: seasonAvg,
                obp: seasonObp,
                slg: seasonSlg,
                hrRate: seasonHrRate,
                paLike: seasonPa,
                abLike: seasonPa * 0.9,
                adjusted: false,
                splitAvg: null,
                label: '通常成績'
            };
        }

        function getAdjustedPitcherMetrics(pData, batterSide) {
            const ip = Math.max(1, Number(pData?.[11] || pData?.[10] || 0));
            const era = clampNumber(pData?.[7] ?? 3.80, 0.80, 7.50);
            const seasonAvgAllowed = clampNumber(era / 10, 0.180, 0.380);
            const seasonKRate = clampNumber((Number(pData?.[8] || 0) / Math.max(ip * 3.5, 1)), 0.050, 0.380);
            const seasonHrRate = clampNumber(0.02 * (era / 3.5), 0.005, 0.090);
            const splitRow = getPitchingSplitRow(pData);
            const useSide = batterSide === 'L' || batterSide === 'R' ? batterSide : null;
            const splitAvg = splitRow && useSide ? (useSide === 'L' ? splitRow.leftAvg : splitRow.rightAvg) : null;
            if (typeof splitAvg === 'number' && Number.isFinite(splitAvg)) {
                const ratio = clampNumber(splitAvg / Math.max(seasonAvgAllowed, 0.180), 0.72, 1.32);
                return {
                    avgAllowed: splitAvg,
                    kRate: clampNumber(seasonKRate / Math.sqrt(ratio), 0.040, 0.420),
                    hrRate: clampNumber(seasonHrRate * ratio, 0.005, 0.100),
                    adjusted: true,
                    splitAvg,
                    label: `対${useSide === 'L' ? '左' : '右'}打者 ${fmtRate(splitAvg)}`
                };
            }
            return {
                avgAllowed: seasonAvgAllowed,
                kRate: seasonKRate,
                hrRate: seasonHrRate,
                adjusted: false,
                splitAvg: null,
                label: '通常成績'
            };
        }

        function battingMasterMap() {
            const map = new Map();
            (window.BATTING_DATA || []).forEach(d => {
                map.set(`${d[0]}|${d[1]}|${d[2]}`, d);
            });
            return map;
        }

        function pitchingMasterMap() {
            const map = new Map();
            (window.PITCHING_DATA || []).forEach(d => {
                map.set(`${d[0]}|${d[1]}|${d[2]}`, d);
            });
            return map;
        }

        function updateBattingMode() {
            const mode = document.getElementById('bm')?.value || 'normal';
            const normal = document.getElementById('bat-normal-wrap');
            const split = document.getElementById('bat-split-wrap');
            const note = document.getElementById('batting-mode-note');
            if (normal) normal.classList.toggle('active', mode === 'normal');
            if (split) split.classList.toggle('active', mode === 'split');
            if (note) note.textContent = mode === 'split'
                ? '対左・対右の打率と左右差を表示中。'
                : '';
            if (mode === 'split') rbs(); else rb();
        }

        function updatePitchingMode() {
            const mode = document.getElementById('pm')?.value || 'normal';
            const normal = document.getElementById('pit-normal-wrap');
            const split = document.getElementById('pit-split-wrap');
            const note = document.getElementById('pitching-mode-note');
            if (normal) normal.classList.toggle('active', mode === 'normal');
            if (split) split.classList.toggle('active', mode === 'split');
            if (note) note.textContent = mode === 'split'
                ? '対左・対右の被打率と左右差を表示中。'
                : '';
            if (mode === 'split') rps(); else rp();
        }

        function srtSplit(type, key) {
            const state = type === 'b' ? bsSort : psSort;
            if (state.key === key) state.asc = !state.asc; else { state.key = key; state.asc = false; }
            const arr = type === 'b' ? bsF : psF;
            arr.sort((a, b) => {
                const v1 = a[key], v2 = b[key];
                if (v1 == null) return 1;
                if (v2 == null) return -1;
                if (typeof v1 === 'string' || typeof v2 === 'string') {
                    const res = String(v1).localeCompare(String(v2), 'ja');
                    return state.asc ? res : -res;
                }
                return state.asc ? (v1 < v2 ? -1 : v1 > v2 ? 1 : 0) : (v1 > v2 ? -1 : v1 < v2 ? 1 : 0);
            });
            if (type === 'b') { bsPage = 1; rbs(); } else { psPage = 1; rps(); }
        }

        // ============================================================
        // FILTER & RENDER: Batting
        // ============================================================
        function getQPA(year) { return year === 2020 ? 372 : 443; }
        function getQIP(year) { return year === 2020 ? 120 : 143; }

        function fb() {
            const y = document.getElementById('by').value;
            const l = document.getElementById('bl').value;
            const t = document.getElementById('bt').value;
            const q = document.getElementById('bq').value;
            const s = document.getElementById('bs').value.trim().toLowerCase();
            const bMap = battingMasterMap();
            bF = BATTING_DATA.filter(d => {
                if (y && String(d[1]) !== y) return false;
                if (l && tleague(d[2]) !== l) return false;
                if (t && d[2] !== t) return false;
                if (q === '1') {
                    const threshold = getQPA(d[1]);
                    if (d[12] < threshold) return false;
                }
                if (s && !d[0].toLowerCase().includes(s)) return false;
                return true;
            });
            bsF = (window.BATTING_SPLIT_DATA || []).filter(d => {
                if (y && String(d.year) !== y) return false;
                if (l && tleague(d.team) !== l) return false;
                if (t && d.team !== t) return false;
                if (s && !String(d.name).toLowerCase().includes(s)) return false;
                if (q === '1') {
                    const master = bMap.get(`${d.name}|${d.year}|${d.team}`);
                    const threshold = getQPA(d.year);
                    const paLike = master ? master[12] : ((d.leftPaAb || 0) + (d.rightPaAb || 0));
                    if ((paLike || 0) < threshold) return false;
                }
                return true;
            });
            bPage = 1;
            bsPage = 1;
            updateBattingMode();
        }
        function rb() {
            const rows = parseInt(document.getElementById('br').value) || 30;
            const start = (bPage - 1) * rows;
            const page = bF.slice(start, start + rows);
            document.getElementById('bb').innerHTML = page.map((d, i) => {
                const r = start + i + 1;
                const rc = r === 1 ? 'r1' : r === 2 ? 'r2' : r === 3 ? 'r3' : 'rk';
                const f3 = v => (typeof v === 'number' ? v.toFixed(3) : '-');
                const avg = f3(d[4]), obp = f3(d[10]), slg = f3(d[11]), ops = f3(d[9]);
                const avc = d[4] >= .330 ? 'vh' : d[4] >= .290 ? 'vm' : '';
                const opc = d[9] >= .900 ? 'vh' : d[9] >= .780 ? 'vm' : '';
                const hrc = d[5] >= 30 ? 'vh' : d[5] >= 20 ? 'vm' : '';
                return `<tr>
      <td class="${rc} rk">${r}</td>
      <td class="pn"><span class="name-link" onclick="showP('${d[0]}','bat')">${d[0]}</span></td>
      <td>${d[1]}</td>
      <td>${ttag(d[2])}</td>
      <td>${d[3]}</td>
      <td class="${avc}">${avg}</td>
      <td class="${hrc}">${d[5]}</td>
      <td>${d[6]}</td>
      <td>${d[7]}</td>
      <td>${d[8]}</td>
      <td>${obp}</td>
      <td>${slg}</td>
      <td class="${opc}">${ops}</td>
      <td>${d[12]}</td>
    </tr>`;
            }).join('');
            pgn('bpg', bF.length, rows, bPage, p => { bPage = p; rb(); });
        }

        function rbs() {
            const rows = parseInt(document.getElementById('br').value) || 30;
            const start = (bsPage - 1) * rows;
            const page = bsF.slice(start, start + rows);
            document.getElementById('bbs').innerHTML = page.map((d, i) => {
                const r = start + i + 1;
                const rc = r === 1 ? 'r1' : r === 2 ? 'r2' : r === 3 ? 'r3' : 'rk';
                return `<tr>
      <td class="${rc} rk">${r}</td>
      <td class="pn"><span class="name-link" onclick="showP('${d.name}','bat')">${d.name}</span></td>
      <td>${d.year}</td>
      <td>${ttag(d.team)}</td>
      <td>${d.position || '-'}</td>
      <td>${fmtCount(d.leftPaAb)}</td>
      <td>${fmtCount(d.leftHits)}</td>
      <td>${fmtCount(d.leftAb)}</td>
      <td class="${d.leftAvg >= .330 ? 'vh' : d.leftAvg >= .290 ? 'vm' : ''}">${fmtRate(d.leftAvg)}</td>
      <td>${fmtCount(d.rightPaAb)}</td>
      <td>${fmtCount(d.rightHits)}</td>
      <td>${fmtCount(d.rightAb)}</td>
      <td class="${d.rightAvg >= .330 ? 'vh' : d.rightAvg >= .290 ? 'vm' : ''}">${fmtRate(d.rightAvg)}</td>
      <td class="${diffClass(d.diffAvg)}">${diffText(d.diffAvg)}</td>
    </tr>`;
            }).join('');
            pgn('bspg', bsF.length, rows, bsPage, p => { bsPage = p; rbs(); });
        }

        // ============================================================
        // FILTER & RENDER: Pitching
        // ============================================================
        function fp() {
            const y = document.getElementById('py').value;
            const l = document.getElementById('pl').value;
            const t = document.getElementById('pt').value;
            const q = document.getElementById('pq').value;
            const s = document.getElementById('ps').value.trim().toLowerCase();
            const pMap = pitchingMasterMap();
            pF = PITCHING_DATA.filter(d => {
                if (y && String(d[1]) !== y) return false;
                if (l && tleague(d[2]) !== l) return false;
                if (t && d[2] !== t) return false;
                if (q === '1') {
                    const threshold = getQIP(d[1]);
                    if (d[11] < threshold) return false;
                }
                if (s && !d[0].toLowerCase().includes(s)) return false;
                return true;
            });
            psF = (window.PITCHING_SPLIT_DATA || []).filter(d => {
                if (y && String(d.year) !== y) return false;
                if (l && tleague(d.team) !== l) return false;
                if (t && d.team !== t) return false;
                if (s && !String(d.name).toLowerCase().includes(s)) return false;
                if (q === '1') {
                    const master = pMap.get(`${d.name}|${d.year}|${d.team}`);
                    const threshold = getQIP(d.year);
                    const ipLike = master ? master[11] : null;
                    if ((ipLike || 0) < threshold) return false;
                }
                return true;
            });
            pPage = 1;
            psPage = 1;
            updatePitchingMode();
        }
        function rp() {
            const rows = parseInt(document.getElementById('pr').value) || 30;
            const start = (pPage - 1) * rows;
            const page = pF.slice(start, start + rows);
            document.getElementById('pb').innerHTML = page.map((d, i) => {
                const r = start + i + 1;
                const rc = r === 1 ? 'r1' : r === 2 ? 'r2' : r === 3 ? 'r3' : 'rk';
                const f2 = v => (typeof v === 'number' ? v.toFixed(2) : '-');
                const f3 = v => (typeof v === 'number' ? v.toFixed(3) : '-');
                const era = f2(d[7]), pct = f3(d[9]);
                const ec = d[7] <= 2.50 ? 'vh' : d[7] <= 3.50 ? 'vm' : '';
                return `<tr>
      <td class="${rc} rk">${r}</td>
      <td class="pn"><span class="name-link" onclick="showP('${d[0]}','pit')">${d[0]}</span></td>
      <td>${d[1]}</td>
      <td>${ttag(d[2])}</td>
      <td>${d[3]}</td>
      <td>${d[4]}</td>
      <td>${d[5]}</td>
      <td>${d[6]}</td>
      <td>${d[12]}</td>
      <td class="${ec}">${era}</td>
      <td>${d[8]}</td>
      <td>${pct}</td>
      <td>${d[10]}</td>
    </tr>`;
            }).join('');
            pgn('ppg', pF.length, rows, pPage, p => { pPage = p; rp(); });
        }

        function rps() {
            const rows = parseInt(document.getElementById('pr').value) || 30;
            const start = (psPage - 1) * rows;
            const page = psF.slice(start, start + rows);
            document.getElementById('pbs').innerHTML = page.map((d, i) => {
                const r = start + i + 1;
                const rc = r === 1 ? 'r1' : r === 2 ? 'r2' : r === 3 ? 'r3' : 'rk';
                const lClass = d.leftAvg <= .220 ? 'vh' : d.leftAvg <= .260 ? 'vm' : '';
                const rClass = d.rightAvg <= .220 ? 'vh' : d.rightAvg <= .260 ? 'vm' : '';
                return `<tr>
      <td class="${rc} rk">${r}</td>
      <td class="pn"><span class="name-link" onclick="showP('${d.name}','pit')">${d.name}</span></td>
      <td>${d.year}</td>
      <td>${ttag(d.team)}</td>
      <td>${d.position || '-'}</td>
      <td>${fmtCount(d.leftAb)}</td>
      <td>${fmtCount(d.leftHits)}</td>
      <td class="${lClass}">${fmtRate(d.leftAvg)}</td>
      <td>${fmtCount(d.rightAb)}</td>
      <td>${fmtCount(d.rightHits)}</td>
      <td class="${rClass}">${fmtRate(d.rightAvg)}</td>
      <td class="${diffClass(d.diffAvg)}">${diffText(d.diffAvg)}</td>
    </tr>`;
            }).join('');
            pgn('pspg', psF.length, rows, psPage, p => { psPage = p; rps(); });
        }

        // ============================================================
        // FILTER & RENDER: Team
        // ============================================================
        function ft() {
            const y = document.getElementById('ty').value;
            const l = document.getElementById('tl').value;
            const t = document.getElementById('tt').value;
            tF = TEAM_DATA.filter(d => {
                if (y && String(d.year) !== y) return false;
                if (l && d.league !== l) return false;
                if (t && d.team !== t) return false;
                return true;
            });
            tPage = 1; rt();
        }
        function rt() {
            const rows = 30;
            const start = (tPage - 1) * rows;
            const page = tF.slice(start, start + rows);
            document.getElementById('tb').innerHTML = page.map((d, i) => {
                const r = start + i + 1;
                const rc = r === 1 ? 'r1' : r === 2 ? 'r2' : r === 3 ? 'r3' : 'rk';
                const pc = d.pct >= .600 ? 'vh' : d.pct >= .530 ? 'vm' : '';
                return `<tr>
      <td class="${rc} rk">${r}</td>
      <td style="white-space:nowrap">${ttag(d.team)}</td>
      <td>${d.year}</td>
      <td>${d.league}</td>
      <td class="${d.w >= 80 ? 'vh' : d.w >= 70 ? 'vm' : ''}">${d.w || 0}</td>
      <td>${d.l || 0}</td>
      <td>${d.t || 0}</td>
      <td class="${pc}">${(d.pct || 0).toFixed(3)}</td>
      <td>${d.rank || '-'}位</td>
      <td>${d.nippon === '○' ? '<span style="color:#fbbf24;font-weight:700">🏆 日本一</span>' : '-'}</td>
    </tr>`;
            }).join('');
            pgn('tpg', tF.length, rows, tPage, p => { tPage = p; rt(); });
        }

        // ============================================================
        // FILTER & RENDER: Order
        // ============================================================
        async function fo() {
            const y = document.getElementById('oy').value;
            const t = document.getElementById('ot').value;
            const body = document.getElementById('ob');
            if (body) body.innerHTML = '<tr><td colspan="12" style="padding:1rem;text-align:center;opacity:.7">読み込み中...</td></tr>';
            if (window.DataStore) {
                if (y) await window.DataStore.ensureOrderYear(y);
                else await window.DataStore.ensureAllOrders();
            }
            oF = ORDER_DATA.filter(d => {
                if (y && String(d[0]) !== y) return false;
                if (t && d[2] !== t) return false;
                return true;
            });
            oPage = 1; ro(); renderOrderTop3();
        }

        function ro() {
            const rows = 30;
            const start = (oPage - 1) * rows;
            const page = oF.slice(start, start + rows);
            document.getElementById('ob').innerHTML = page.map(d => `
                <tr>
                    <td>${d[1]}</td>
                    <td>${ttag(d[2])}</td>
                    ${d.slice(3, 12).map(p => `<td>${p}</td>`).join('')}
                    <td class="pn">${d[12]}</td>
                </tr>
            `).join('');
            pgn('opg', oF.length, rows, oPage, p => { oPage = p; ro(); });
        }

        function renderOrderTop3() {
            const y = document.getElementById('oy').value;
            const t = document.getElementById('ot').value;
            const container = document.getElementById('order-top3');
            if (!y || !t || !ORDER_TOP3[t] || !ORDER_TOP3[t][y]) {
                container.innerHTML = '<div style="grid-column:1/-1;padding:2rem;text-align:center;opacity:.5">年度とチームを選択してください</div>';
                return;
            }
            const data = ORDER_TOP3[t][y];
            let html = '';
            for (let i = 1; i <= 9; i++) {
                const tops = data[i] || [];
                html += `
                    <div class="order-card">
                        <div class="order-pos">${i}番</div>
                        ${tops.map((p, idx) => `
                            <div class="top-item">
                                <div class="top-player"><span class="top-rank">${idx + 1}</span>${p.player}</div>
                                <div class="top-sub">${p.count} 試合</div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
            container.innerHTML = html;
        }

        // ============================================================
        // SORT
        // ============================================================
        function srt(type, ci) {
            let state;
            if (type === 'b') state = bSort;
            if (type === 'p') state = pSort;
            if (type === 't') state = tSort;
            if (state.c === ci) state.asc = !state.asc; else { state.c = ci; state.asc = false; }

            function cmp(a, b) {
                let v1, v2;
                if (type === 't') {
                    const keys = ['team', 'year', 'league', 'w', 'l', 't', 'pct', 'rank', 'nippon'];
                    v1 = a[keys[ci]]; v2 = b[keys[ci]];
                } else { v1 = a[ci]; v2 = b[ci]; }
                if (v1 == null) return 1; if (v2 == null) return -1;
                return state.asc ? (v1 < v2 ? -1 : v1 > v2 ? 1 : 0) : (v1 > v2 ? -1 : v1 < v2 ? 1 : 0);
            }
            if (type === 'b') { bF.sort(cmp); bPage = 1; rb(); }
            if (type === 'p') { pF.sort(cmp); pPage = 1; rp(); }
            if (type === 't') { tF.sort(cmp); tPage = 1; rt(); }
        }

        // ============================================================
        // PAGINATION
        // ============================================================
        function pgn(id, total, rows, current, cb) {
            const pages = Math.ceil(total / rows);
            const el = document.getElementById(id);
            if (pages <= 1) { el.innerHTML = ''; return; }
            let html = ''; const w = 5;
            const start = Math.max(1, current - w), end = Math.min(pages, current + w);
            if (start > 1) html += `<button onclick="(${cb})(1)">1</button>`;
            if (start > 2) html += `<button disabled>…</button>`;
            for (let i = start; i <= end; i++) html += `<button class="${i === current ? 'active' : ''}" onclick="(${cb})(${i})">${i}</button>`;
            if (end < pages - 1) html += `<button disabled>…</button>`;
            if (end < pages) html += `<button onclick="(${cb})(${pages})">${pages}</button>`;
            el.innerHTML = html;
        }

        // ============================================================
        // RECORDS
        // ============================================================
        function renderRecords() {
            // Rate-based stats (Qualified batters only)
            const qualified = [...BATTING_DATA].filter(d => d[12] >= getQPA(d[1]));
            const bestAvg = qualified.sort((a, b) => b[4] - a[4])[0] || [null, 0, '-', 0, 0];
            const bestOBP = qualified.sort((a, b) => b[10] - a[10])[0] || [null, 0, '-', 0, 0, 0, 0, 0, 0, 0, 0];
            const bestSLG = qualified.sort((a, b) => b[11] - a[11])[0] || [null, 0, '-', 0, 0, 0, 0, 0, 0, 0, 0, 0];
            const bestOPS = qualified.sort((a, b) => b[9] - a[9])[0] || [null, 0, '-', 0, 0, 0, 0, 0, 0, 0];

            // Count-based stats (All players)
            const allBat = [...BATTING_DATA];
            const bestHR = allBat.sort((a, b) => b[5] - a[5])[0] || [null, 0, '-', 0, 0, 0];
            const bestRBI = allBat.sort((a, b) => b[6] - a[6])[0] || [null, 0, '-', 0, 0, 0, 0];
            const bestH = allBat.sort((a, b) => b[7] - a[7])[0] || [null, 0, '-', 0, 0, 0, 0, 0];
            const bestSB = allBat.sort((a, b) => b[8] - a[8])[0] || [null, 0, '-', 0, 0, 0, 0, 0, 0];

            const pitS = [...PITCHING_DATA].filter(d => d[7] > 0);
            const bestERA = pitS.filter(d => d[11] >= getQIP(d[1])).sort((a, b) => a[7] - b[7])[0] || [null, 0, '-', 0, 0, 0, 0, 0];
            const bestK = pitS.sort((a, b) => b[8] - a[8])[0] || [null, 0, '-', 0, 0, 0, 0, 0, 0];
            const bestSv = pitS.sort((a, b) => b[6] - a[6])[0] || [null, 0, '-', 0, 0, 0, 0];

            const recs = [
                { label: '打率トップ', val: Number(bestAvg[4]).toFixed(3), name: bestAvg[0], detail: `${bestAvg[1]}年 ${bestAvg[2]}`, icon: '🥇', sub: '規定以上' },
                { label: '本塁打トップ', val: bestHR[5] + '本', name: bestHR[0], detail: `${bestHR[1]}年 ${bestHR[2]}`, icon: '💣', sub: '全体' },
                { label: '打点トップ', val: bestRBI[6] + '点', name: bestRBI[0], detail: `${bestRBI[1]}年 ${bestRBI[2]}`, icon: '🎯', sub: '全体' },
                { label: '安打トップ', val: bestH[7] + '本', name: bestH[0], detail: `${bestH[1]}年 ${bestH[2]}`, icon: '🏏', sub: '全体' },
                { label: '盗塁トップ', val: bestSB[8] + '個', name: bestSB[0], detail: `${bestSB[1]}年 ${bestSB[2]}`, icon: '💨', sub: '全体' },
                { label: '出塁率トップ', val: Number(bestOBP[10]).toFixed(3), name: bestOBP[0], detail: `${bestOBP[1]}年 ${bestOBP[2]}`, icon: '📈', sub: '規定以上' },
                { label: '長打率トップ', val: Number(bestSLG[11]).toFixed(3), name: bestSLG[0], detail: `${bestSLG[1]}年 ${bestSLG[2]}`, icon: '💥', sub: '規定以上' },
                { label: 'OPSトップ', val: Number(bestOPS[9]).toFixed(3), name: bestOPS[0], detail: `${bestOPS[1]}年 ${bestOPS[2]}`, icon: '📊', sub: '規定以上' },
                { label: '最優秀防御率', val: Number(bestERA[7]).toFixed(2), name: bestERA[0], detail: `${bestERA[1]}年 ${bestERA[2]}`, icon: '🛡', sub: '規定以上' },
                { label: '奪三振トップ', val: bestK[8] + 'K', name: bestK[0], detail: `${bestK[1]}年 ${bestK[2]}`, icon: '⚡', sub: '全体' },
                { label: 'セーブトップ', val: bestSv[6] + 'S', name: bestSv[0], detail: `${bestSv[1]}年 ${bestSv[2]}`, icon: '🔒', sub: '全体' },
            ];
            document.getElementById('recs').innerHTML = recs.map(r => `
    <div class="card">
      <div class="cl">${r.icon} ${r.label} <span style="font-size:.7rem;opacity:.6;margin-left:4px">(${r.sub})</span></div>
      <div class="cv">${r.val}</div>
      <div class="cn">${r.name}</div>
      <div class="cd">${r.detail}</div>
    </div>`).join('');

            // Champ bars
            const champMap = {};
            const champYears = {};
            const teamRows = getResolvedNipponSeriesWinners();
            teamRows.forEach(d => {
                if (d?.nippon === '○') {
                    champMap[d.team] = (champMap[d.team] || 0) + 1;
                    (champYears[d.team] ||= []).push(Number(d.year));
                }
            });
            const champs = Object.entries(champMap).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));
            const maxC = champs[0]?.[1] || 1;
            const cols = { giants: '#ff6b2b', tigers: '#ffe033', dragons: '#2b8cff', carp: '#ff4444', swallows: '#3bc5ff', baystars: '#648fff', hawks: '#ffd52b', lions: '#2bdcff', eagles: '#e05555', marines: '#5577ff', fighters: '#4488ff', buffaloes: '#22cc66' };
            const champRoot = document.getElementById('chbars');
            if (!champs.length) {
                champRoot.innerHTML = `<div style="padding:1rem;border:1px dashed var(--bd);border-radius:10px;color:var(--tx2);font-size:.85rem">日本一データがまだありません。TEAM_DATA の nippon 列か、日本一の年度マッピングを確認してください。</div>`;
                return;
            }
            champRoot.innerHTML = champs.map(([t, c]) => {
                const tag = TM[t]?.tag || 'giants';
                const col = cols[tag] || '#888';
                const pct = (c / maxC * 100).toFixed(1);
                const years = (champYears[t] || []).sort((a, b) => a - b);
                return `<div style="padding:.25rem 0 .8rem;border-bottom:1px solid rgba(255,255,255,.06)">
      <div class="bar-row" style="margin-bottom:.35rem">
        <div class="bar-lbl">${t}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${col}">${c}</div></div>
        <div class="bar-num" style="color:${col}">${c}回</div>
      </div>
      <div style="margin-left:calc(150px + .6rem);font-size:.73rem;color:var(--tx2)">優勝年: ${years.join(' / ')}</div>
    </div>`;
            }).join('');
        }

        // ============================================================
        // NAVIGATION
        // ============================================================
        async function show(id) {
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
            const target = document.getElementById('section-' + id);
            if (target) target.classList.add('active');

            const titles = {
                home: '⚾ NPB <em>打順・成績分析ラボ</em>',
                current: '🗂 NPB <em>今年度 選手マスタ</em>',
                batting: '⚾ NPB <em>打撃成績統計</em>',
                pitching: '⚾ NPB <em>投手成績統計</em>',
                simulator: '⚾ NPB <em>1打席シミュレーター</em>',
                order: '📋 NPB <em>チームオーダー分析</em>',
                myorder: '🔥 NPB <em>俺のオーダー</em>',
                'pro-report': '📊 NPB <em>分析レポート</em>',
                team: '🏆 NPB <em>チーム年度別成績</em>',
                records: '🥇 NPB <em>歴代最高記録</em>'
            };
            const subs = {
                home: '今年度の選手マスタを起点に、打順・成績・分析を横断して見られる野球データサイト',
                current: '12球団の選手マスタを球団・区分・ポジション別に確認',
                batting: '打率、本塁打、打点など打撃各部門のシーズン統計',
                pitching: '防御率、奪三振、勝利数など投手各部門のシーズン統計',
                simulator: '打者と投手を選んで1打席の結果をざっくり比較',
                order: '全12球団のスタメン履歴と打順別起用傾向を確認',
                myorder: '自分のスタメンを組み、得点期待値を試す',
                'pro-report': '勝率トレンドや相関分析をグラフで確認',
                team: '年度別の順位、勝敗、リーグ内戦績の推移を確認',
                records: '2020年以降のNPBにおける最高記録・主要指標'
            };
            const summaryCounts = window.SITE_SUMMARY?.counts || {};
            const currentCount = window.CURRENT_PLAYER_MASTER?.length || 0;
            const counts = {
                home: (currentCount || ((window.BATTING_DATA?.length || summaryCounts.batting || 0) + (window.PITCHING_DATA?.length || summaryCounts.pitching || 0))) + (currentCount ? '人' : '件'),
                current: currentCount ? currentCount + '人' : '読込中',
                batting: (window.BATTING_DATA?.length || summaryCounts.batting || 0) + '件',
                pitching: (window.PITCHING_DATA?.length || summaryCounts.pitching || 0) + '件',
                order: (window.ORDER_DATA?.length || summaryCounts.order || 0) + '試合',
                myorder: '9人編成',
                'pro-report': '3グラフ',
                simulator: '1打席比較',
                team: (window.SITE_SUMMARY?.teams?.length || 12) + '球団',
                records: '記録カテゴリ'
            };
            const countLabels = {
                home: '登録選手数',
                current: '登録選手数',
                batting: '打撃レコード',
                pitching: '投手レコード',
                order: '打順履歴',
                myorder: '編成単位',
                'pro-report': '可視化数',
                simulator: '分析単位',
                team: '収録球団',
                records: '記録カテゴリ'
            };

            document.getElementById('hero-title').innerHTML = titles[id] || titles.home;
            document.getElementById('hero-sub').textContent = 'データを読み込み中...';
            document.getElementById('hero-count').textContent = counts[id] || '-';
            document.getElementById('hero-count-label').textContent = countLabels[id] || '統計項目';

            document.querySelectorAll('nav button').forEach(b => {
                if (b.getAttribute('onclick') === `show('${id}')`) b.classList.add('active');
            });

            try {
                if (window.DataStore) await window.DataStore.ensureSectionData(id);
                if (['batting', 'simulator', 'myorder'].includes(id) && window.SplitDataStore) await window.SplitDataStore.ensureBattingSplit();
                if (['pitching', 'simulator', 'myorder'].includes(id) && window.SplitDataStore) await window.SplitDataStore.ensurePitchingSplit();
                if (['simulator', 'myorder'].includes(id) && window.HandednessStore) await window.HandednessStore.ensure();

                if (['batting', 'pitching', 'team', 'order', 'records', 'pro-report', 'myorder'].includes(id)) {
                    initDropdowns();
                }
                if (id === 'current' && window.CurrentMasterStore) {
                    await window.CurrentMasterStore.ensure();
                    initCurrentMasterFilters();
                }

                if (id === 'order') {
                    const oy = document.getElementById('oy');
                    if (oy && !oy.value && window.SITE_SUMMARY?.latestYear) oy.value = String(window.SITE_SUMMARY.latestYear);
                }

                const updatedCurrentCount = window.CURRENT_PLAYER_MASTER?.length || 0;
                const updatedCounts = {
                    home: (updatedCurrentCount || ((window.BATTING_DATA?.length || summaryCounts.batting || 0) + (window.PITCHING_DATA?.length || summaryCounts.pitching || 0))) + (updatedCurrentCount ? '人' : '件'),
                    current: updatedCurrentCount ? updatedCurrentCount + '人' : '読込中',
                    batting: (window.BATTING_DATA?.length || summaryCounts.batting || 0) + '件',
                    pitching: (window.PITCHING_DATA?.length || summaryCounts.pitching || 0) + '件',
                    order: (window.ORDER_DATA?.length || summaryCounts.order || 0) + '試合',
                    myorder: '9人編成',
                    'pro-report': '3グラフ',
                    simulator: '1打席比較',
                    team: (window.SITE_SUMMARY?.teams?.length || 12) + '球団',
                    records: '記録カテゴリ'
                };
                document.getElementById('hero-sub').textContent = subs[id] || subs.home;
                document.getElementById('hero-count').textContent = updatedCounts[id] || '-';

                if (id === 'batting') { fb(); }
                if (id === 'pitching') { fp(); }
                if (id === 'team') { tF = [...TEAM_DATA]; rt(); }
                if (id === 'current') { renderCurrentMaster(); }
                if (id === 'order') await fo();
                if (id === 'records') renderRecords();
                if (id === 'myorder') initOrderBuilder();
                if (id === 'pro-report') initProReport();
                if (id === 'simulator') { upSimB(); upSimP(); }
                if (id === 'home') updateHomeCounts();
            } catch (error) {
                console.warn(error);
                document.getElementById('hero-sub').textContent = 'データの読み込みに失敗しました。';
            }
        }

        // ============================================================
        // PLAYER DETAIL MODAL
        // ============================================================
        let myChart = null;

        function closeP() {
            document.getElementById('modal-ov').classList.remove('active');
            if (myChart) { myChart.destroy(); myChart = null; }
        }

        function showP(name, type) {
            const data = type === 'bat'
                ? BATTING_DATA.filter(d => d[0] === name).sort((a, b) => a[1] - b[1])
                : PITCHING_DATA.filter(d => d[0] === name).sort((a, b) => a[1] - b[1]);

            if (!data.length) return;

            document.getElementById('modal-name').textContent = name;
            const latest = data[data.length - 1];
            document.getElementById('modal-team').innerHTML = `${ttag(latest[2])} ${latest[2]}`;

            let summaryHTML = '';
            if (type === 'bat') {
                const totalG = data.reduce((s, d) => s + d[3], 0);
                const totalH = data.reduce((s, d) => s + d[7], 0);
                const totalHR = data.reduce((s, d) => s + d[5], 0);
                summaryHTML = `
                    <div class="stat-item"><div class="stat-label">通算試合</div><div class="stat-val">${totalG}</div></div>
                    <div class="stat-item"><div class="stat-label">通算安打</div><div class="stat-val">${totalH}</div></div>
                    <div class="stat-item"><div class="stat-label">通算本塁打</div><div class="stat-val">${totalHR}</div></div>
                `;
            } else {
                const totalG = data.reduce((s, d) => s + d[3], 0);
                const totalW = data.reduce((s, d) => s + d[4], 0);
                const totalK = data.reduce((s, d) => s + d[8], 0);
                summaryHTML = `
                    <div class="stat-item"><div class="stat-label">通算登板</div><div class="stat-val">${totalG}</div></div>
                    <div class="stat-item"><div class="stat-label">通算勝利</div><div class="stat-val">${totalW}</div></div>
                    <div class="stat-item"><div class="stat-label">通算奪三振</div><div class="stat-val">${totalK}</div></div>
                `;
            }
            document.getElementById('modal-stats').innerHTML = summaryHTML;

            const labels = data.map(d => d[1] + '年');
            const sets = [];

            if (type === 'bat') {
                sets.push({
                    label: '打率',
                    data: data.map(d => d[4]),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                    yAxisID: 'y',
                    tension: 0.3
                });
                sets.push({
                    label: '本塁打',
                    data: data.map(d => d[5]),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    yAxisID: 'y1',
                    tension: 0.3
                });
            } else {
                sets.push({
                    label: '防御率',
                    data: data.map(d => d[7]),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    yAxisID: 'y',
                    tension: 0.3
                });
                sets.push({
                    label: '勝利数',
                    data: data.map(d => d[4]),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    yAxisID: 'y1',
                    tension: 0.3
                });
            }

            document.getElementById('modal-ov').classList.add('active');

            setTimeout(() => {
                const ctx = document.getElementById('playerChart').getContext('2d');
                myChart = new Chart(ctx, {
                    type: 'line',
                    data: { labels, datasets: sets },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        scales: {
                            y: { type: 'linear', display: true, position: 'left', grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
                            y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#9ca3af' } }
                        },
                        plugins: {
                            legend: { labels: { color: '#f9fafb', font: { weight: 'bold' } } }
                        }
                    }
                });
            }, 100);
        }

        // ============================================================
        // BOOT
        // ============================================================
        window.onload = async () => {
            if (window.DataStore) {
                try {
                    await window.DataStore.ensureSummary();
                } catch (error) {
                    console.warn(error);
                }
            }
            if (window.CurrentMasterStore) {
                try {
                    await window.CurrentMasterStore.ensure();
                    initCurrentMasterFilters();
                } catch (error) {
                    console.warn(error);
                }
            }
            updateHomeCounts();

            const years = (window.SITE_SUMMARY?.years || [2025, 2024, 2023, 2022, 2021, 2020]).slice().sort((a, b) => b - a);
            const sy = ['sb-y', 'sp-y'];
            sy.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '<option value="">全年度</option>' +
                    years.map(y => `<option value="${y}">${y}年</option>`).join('');
            });

            const teams = window.SITE_SUMMARY?.teams || ['読売ジャイアンツ', '阪神タイガース', '横浜DeNAベイスターズ', '広島東洋カープ', '東京ヤクルトスワローズ', '中日ドラゴンズ', '福岡ソフトバンクホークス', '北海道日本ハムファイターズ', 'オリックス・バファローズ', '東北楽天ゴールデンイーグルス', '埼玉西武ライオンズ', '千葉ロッテマリーンズ'];
            const st = ['sb-t', 'sp-t'];
            st.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '<option value="">全チーム</option>' +
                    teams.map(t => `<option value="${t}">${t}</option>`).join('');
            });

            show('home');
        };

        // ============================================================
        // MY ORDER BUILDER & SIMULATOR
        // ============================================================
        let moBatters = []; // 選択可能な野手リスト
        let moPitchers = []; // 相手チームの投手リスト
        let moSelectedBatters = new Array(9).fill(null); // 1〜9番の選択状態

        function initOrderBuilder() {
            const y = document.getElementById('mo-year').value || '2025';
            const tSel = document.getElementById('mo-team');

            // チームリストの生成（初回のみ）
            if (tSel.options.length === 0) {
                const teams = [...new Set(TEAM_DATA.map(d => d.team))].sort();
                tSel.innerHTML = teams.map(t => `<option value="${t}">${t}</option>`).join('');
                document.getElementById('mo-vs-team').innerHTML = teams.map(t => `<option value="${t}">${t}</option>`).join('');
                // デフォルトで別チームを選択
                if (teams.length > 1) document.getElementById('mo-vs-team').value = teams[1];
            }
            const t = tSel.value;

            // 選択年・チームの野手リストを取得（打席数順）
            moBatters = BATTING_DATA
                .filter(d => String(d[1]) === y && d[2] === t)
                .sort((a, b) => b[12] - a[12]);

            moSelectedBatters.fill(null); // リセット

            // 打順1~9のUI生成
            let html = '';
            for (let i = 0; i < 9; i++) {
                html += `
                    <div class="builder-row">
                        <div class="builder-pos">${i + 1}</div>
                        <select class="builder-select" id="mo-b${i}" onchange="handleBatterSelect(${i})">
                            <option value="">-- 打者を選択 --</option>
                            ${moBatters.map(b => `<option value="${b[0]}">${b[0]} (率${Number(b[4]).toFixed(3)}/本${b[5]})</option>`).join('')}
                        </select>
                        <div class="builder-stats" id="mo-s${i}"></div>
                    </div>
                `;
            }
            document.getElementById('mo-batters-container').innerHTML = html;

            updateOpponentPitchers();
            calculateOrderStats();
        }

        function getOrderPitcherHand() {
            const pName = document.getElementById('mo-vs-pitcher')?.value || '';
            if (!pName) return null;
            const pData = moPitchers.find(d => d[0] === pName);
            return getPitcherThrowHand(pData);
        }

        function renderOrderBatterStat(index) {
            const statDiv = document.getElementById(`mo-s${index}`);
            if (!statDiv) return;
            const name = moSelectedBatters[index];
            if (!name) {
                statDiv.innerHTML = '';
                return;
            }
            const bData = moBatters.find(d => d[0] === name);
            if (!bData) {
                statDiv.innerHTML = '';
                return;
            }
            const hand = getOrderPitcherHand();
            const metrics = getAdjustedBatterMetrics(bData, hand);
            const avgText = fmtRate(metrics.avg).replace(/^0/, '');
            const opsText = fmtRate(metrics.obp + metrics.slg).replace(/^0/, '');
            const chip = metrics.adjusted
                ? `<span style="margin-left:.5rem;color:var(--ac2);font-weight:700;">${metrics.label}</span>`
                : `<span style="margin-left:.5rem;color:var(--tx2);font-weight:700;">通常</span>`;
            statDiv.innerHTML = `<span>.</span>${avgText.replace('.', '')} / <span>${bData[5]}</span>本 / OPS <span>.</span>${opsText.replace('.', '')}${chip}`;
        }

        function refreshOrderSplitStatus() {
            const note = document.getElementById('mo-split-note');
            const auto = document.getElementById('mo-vs-hand-auto');
            if (!note) return;
            const hand = getOrderPitcherHand();
            const selected = moSelectedBatters.filter(Boolean).length;
            if (auto) auto.textContent = hand ? handLabel(hand) : '先発投手から判定できません';
            if (selected) {
                note.textContent = hand
                    ? `現在は ${handLabel(hand)} 想定で、各打者の対${hand === 'L' ? '左' : '右'}成績を優先して計算します。`
                    : '先発投手の投球左右を判定できないため、現在は通常成績ベースです。';
            } else {
                note.textContent = hand
                    ? `現在は ${handLabel(hand)} 想定です。打者を選ぶと左右補正を反映します。`
                    : '先発投手を選ぶと投球左右を自動判定します。';
            }
        }

        function handleOrderHandChange() {
            for (let i = 0; i < 9; i++) renderOrderBatterStat(i);
            refreshOrderSplitStatus();
            calculateOrderStats();
        }

        // 打者選択時のハンドリング（重複防止とスタッツ表示）
        function handleBatterSelect(index) {
            const sel = document.getElementById(`mo-b${index}`);
            const name = sel.value;

            let isDuplicate = false;
            for (let i = 0; i < 9; i++) {
                if (i !== index && moSelectedBatters[i] === name && name !== "") {
                    isDuplicate = true;
                    alert("同じ選手は複数回選択できません。");
                    sel.value = "";
                    break;
                }
            }

            if (!isDuplicate) {
                moSelectedBatters[index] = name || null;
            } else {
                moSelectedBatters[index] = null;
            }

            renderOrderBatterStat(index);
            refreshOrderSplitStatus();
            calculateOrderStats();
        }

        // チーム合計スタッツの計算
        function calculateOrderStats() {
            const hand = getOrderPitcherHand();
            let totalH = 0, totalHR = 0, totalAB = 0, totalOBP = 0, totalSLG = 0;
            let count = 0;

            moSelectedBatters.forEach((name, index) => {
                if (!name) {
                    renderOrderBatterStat(index);
                    return;
                }
                const bData = moBatters.find(d => d[0] === name);
                if (bData) {
                    const metrics = getAdjustedBatterMetrics(bData, hand);
                    const ab = Number(metrics.abLike || (bData[12] * 0.9));
                    totalH += metrics.avg * ab;
                    totalHR += Math.max(0, Math.round(Number(bData[5] || 0) * clampNumber(metrics.hrRate / Math.max(Number(bData[5] || 0) / Math.max(Number(bData[12] || 1), 1), 0.002), 0.70, 1.30)));
                    totalAB += ab;
                    totalOBP += metrics.obp;
                    totalSLG += metrics.slg;
                    count++;
                }
                renderOrderBatterStat(index);
            });

            if (count > 0) {
                const teamAvg = totalAB > 0 ? (totalH / totalAB).toFixed(3) : ".000";
                document.getElementById('mo-sum-avg').textContent = teamAvg;
                document.getElementById('mo-sum-hr').textContent = totalHR;
                document.getElementById('mo-sum-ops').textContent = (count > 0 ? ((totalOBP + totalSLG) / count).toFixed(3) : '.000');
            } else {
                document.getElementById('mo-sum-avg').textContent = ".000";
                document.getElementById('mo-sum-hr').textContent = "0";
                document.getElementById('mo-sum-ops').textContent = ".000";
            }
            refreshOrderSplitStatus();
            checkBuilderState();
        }

        // 対戦相手投手のリスト更新
        function updateOpponentPitchers() {
            const y = document.getElementById('mo-year').value || '2025';
            const t = document.getElementById('mo-vs-team').value;

            moPitchers = PITCHING_DATA
                .filter(d => String(d[1]) === y && d[2] === t && d[11] > 30)
                .sort((a, b) => b[11] - a[11]);

            const sel = document.getElementById('mo-vs-pitcher');
            const prev = sel.value;
            sel.innerHTML = '<option value="">-- 先発投手を選択 --</option>' +
                moPitchers.map(p => `<option value="${p[0]}">${p[0]} (防${Number(p[7]).toFixed(2)}/回${p[11]})</option>`).join('');
            if (prev && [...sel.options].some(opt => opt.value === prev)) sel.value = prev;

            handleOrderHandChange();
            checkBuilderState();
        }

        // 実行ボタンの活性化チェック
        function checkBuilderState() {
            const btn = document.getElementById('mo-run-btn');
            const hasPitcher = document.getElementById('mo-vs-pitcher').value !== '';
            const numBatters = moSelectedBatters.filter(n => n !== null).length;

            // 9人全員と投手が選ばれていれば実行可能
            btn.disabled = !(hasPitcher && numBatters === 9);
            document.getElementById('mo-result').style.display = 'none'; // 条件が変わったら結果を隠す
            refreshOrderSplitStatus();
        }

        // アドバンスド・シミュレーションの実行（得点期待値予測）
        function runAdvancedSim() {
            const pName = document.getElementById('mo-vs-pitcher').value;
            const pData = moPitchers.find(d => d[0] === pName);
            if (!pData) return;

            const hand = getOrderPitcherHand();
            const L_OBP = 0.320, L_SLG = 0.380;
            const pERA = Number(pData[7] || 3.80);
            const pFactor = pERA / 3.80;
            const pEstimatedOBP = Math.max(0.240, L_OBP * pFactor);
            const pEstimatedSLG = Math.max(0.280, L_SLG * pFactor);

            let totalExpectedRuns = 0;

            const log5 = (b, p, l) => {
                const num = (b * p) / l;
                const den = num + ((1 - b) * (1 - p) / (1 - l));
                return den ? num / den : 0;
            };

            moSelectedBatters.forEach(bName => {
                const bData = moBatters.find(d => d[0] === bName);
                if (bData) {
                    const metrics = getAdjustedBatterMetrics(bData, hand);
                    const adjOBP = log5(metrics.obp, pEstimatedOBP, L_OBP);
                    const adjSLG = log5(metrics.slg, pEstimatedSLG, L_SLG);
                    const runValuePerPA = (Math.pow(adjOBP, 1.25) * Math.pow(adjSLG, 0.75)) * 1.5;
                    totalExpectedRuns += (runValuePerPA * 4.3);
                }
            });

            let finalRuns = totalExpectedRuns * 0.95;
            if (pERA < 2.0 && finalRuns > 2.5) finalRuns = 1.0 + (finalRuns - 1.0) * 0.3;

            const teamExpectedRuns = Math.max(0.1, finalRuns);
            const opponentExpectedRuns = 3.50;
            const pythExp = 1.83;
            const winProb = Math.pow(teamExpectedRuns, pythExp) / (Math.pow(teamExpectedRuns, pythExp) + Math.pow(opponentExpectedRuns, pythExp));

            document.getElementById('mo-expected-runs').textContent = teamExpectedRuns.toFixed(2) + ' 点';
            const wpPct = (winProb * 100).toFixed(1);
            let wpColor = wpPct > 50 ? 'var(--gr)' : wpPct < 40 ? 'var(--re)' : 'var(--tx)';
            let wpText = wpPct > 60 ? '🔥 優勢' : wpPct > 50 ? '📈 微有利' : wpPct > 40 ? '⚔️ 互角' : '📉 劣勢';

            document.getElementById('mo-win-prob').innerHTML = `<span style="color:${wpColor}">${wpPct}% (${wpText})</span><div style="margin-top:.5rem;font-size:.8rem;color:var(--tx2);font-weight:700;">${handLabel(hand)}想定で打線を補正</div>`;
            document.getElementById('mo-result').style.display = 'block';
        }
        // ============================================================
        // PROFESSIONAL ANALYTICS REPORT
        // ============================================================
        let proCharts = [];

        function initProReport() {
            proCharts.forEach(c => c.destroy());
            proCharts = [];

            const years = [2020, 2021, 2022, 2023, 2024, 2025];
            const teams = [...new Set(TEAM_DATA.map(d => d.team))].sort();
            const cols = { giants: '#ff6b2b', tigers: '#ffe033', dragons: '#2b8cff', carp: '#ff4444', swallows: '#3bc5ff', baystars: '#648fff', hawks: '#ffd52b', lions: '#2bdcff', eagles: '#e05555', marines: '#5577ff', fighters: '#4488ff', buffaloes: '#22cc66' };

            // 1. Win Trend Chart
            const trendDatasets = teams.map(t => {
                const tag = TM[t]?.tag || 'giants';
                return {
                    label: sn(t),
                    data: years.map(y => {
                        const d = TEAM_DATA.find(rd => rd.team === t && rd.year === y);
                        return d ? d.pct : null;
                    }),
                    borderColor: cols[tag] || '#888',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 3,
                    tension: 0.2,
                    hidden: !(t === '読売ジャイアンツ' || t === '阪神タイガース' || t === '福岡ソフトバンクホークス') // Default show top
                };
            });

            proCharts.push(new Chart(document.getElementById('chart-win-trend').getContext('2d'), {
                type: 'line',
                data: { labels: years, datasets: trendDatasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, color: '#9ca3af', font: { size: 10 } } } },
                    scales: {
                        y: { min: 0.3, max: 0.7, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
                        x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
                    }
                }
            }));

            // 2. ERA vs Win% Correlation
            // Calculate Team ERA per year
            const eraWinNodes = [];
            years.forEach(y => {
                teams.forEach(t => {
                    const tStats = TEAM_DATA.find(rd => rd.team === t && rd.year === y);
                    if (!tStats) return;

                    const pData = PITCHING_DATA.filter(p => p[1] === y && p[2] === t);
                    let totalER = 0, totalIP = 0;
                    pData.forEach(p => {
                        totalER += (p[7] * p[11] / 9); // Estimated ER
                        totalIP += p[11];
                    });

                    if (totalIP > 100) {
                        const teamERA = (totalER * 9) / totalIP;
                        eraWinNodes.push({ x: teamERA, y: tStats.pct, team: t, year: y });
                    }
                });
            });

            proCharts.push(new Chart(document.getElementById('chart-era-win').getContext('2d'), {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: '球団データ',
                        data: eraWinNodes,
                        backgroundColor: 'rgba(59, 130, 246, 0.6)',
                        pointRadius: 6,
                        hoverRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: (ctx) => `${ctx.raw.year} ${ctx.raw.team}: 防御率 ${ctx.raw.x.toFixed(2)}, 勝率 ${ctx.raw.y.toFixed(3)}`
                            }
                        }
                    },
                    scales: {
                        x: { title: { display: true, text: 'チーム防御率', color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
                        y: { title: { display: true, text: '勝率', color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } }
                    }
                }
            }));

            // 3. League Comparison
            const lAvg = ['セ', 'パ'].map(l => {
                const sub = TEAM_DATA.filter(d => d.league === l);
                return {
                    league: l,
                    avgPct: sub.reduce((a, b) => a + b.pct, 0) / sub.length,
                    avgW: sub.reduce((a, b) => a + b.w, 0) / sub.length
                };
            });

            proCharts.push(new Chart(document.getElementById('chart-league-stats').getContext('2d'), {
                type: 'bar',
                data: {
                    labels: ['セ・リーグ', 'パ・リーグ'],
                    datasets: [{
                        label: '平均勝率',
                        data: lAvg.map(l => l.avgPct),
                        backgroundColor: ['rgba(59, 130, 246, 0.6)', 'rgba(239, 68, 68, 0.6)'],
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { min: 0.45, max: 0.55, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
                        x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
                    }
                }
            }));
        }
    