	window.ProDashboardShared = window.ProDashboardShared || (function() {
		function normalizeMetricName(value) {
			return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
		}

		function hasActualRealValue(row, index) {
			if (!row) {
				return false;
			}

			if (Array.isArray(row.hasRealFlags)) {
				return Boolean(row.hasRealFlags[index]);
			}

			return Math.abs(Number(row.values && row.values[index] || 0)) > 0.0001;
		}

		function getActualRealValue(row, index) {
			if (!row) {
				return 0;
			}

			if (Array.isArray(row.actualValues)) {
				return Number(row.actualValues[index] || 0);
			}

			return Number(row.values && row.values[index] || 0);
		}

		function parseChartMonthLabel(label) {
			const parts = String(label || '').trim().split(/\s+/);
			if (parts.length < 2) {
				return null;
			}

			const monthMap = {
				januar: 0,
				februar: 1,
				marec: 2,
				april: 3,
				maj: 4,
				jun: 5,
				jul: 6,
				august: 7,
				september: 8,
				oktober: 9,
				november: 10,
				december: 11,
			};
			const monthName = normalizeMetricName(parts[0]);
			const yearValue = Number(parts[1]);
			if (!Object.prototype.hasOwnProperty.call(monthMap, monthName) || !yearValue) {
				return null;
			}

			return new Date(yearValue, monthMap[monthName], 1);
		}

		function isChartMonthClosed(label) {
			const monthDate = parseChartMonthLabel(label);
			if (!monthDate) {
				return false;
			}

			const now = new Date();
			const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
			return monthDate.getTime() < currentMonthStart.getTime();
		}

		function getChartQuarterKey(label) {
			const monthDate = parseChartMonthLabel(label);
			if (!monthDate) {
				return '';
			}

			const month = monthDate.getMonth();
			if (month >= 2 && month <= 4) {
				return 'q1';
			}
			if (month >= 5 && month <= 7) {
				return 'q2';
			}
			if (month >= 8 && month <= 10) {
				return 'q3';
			}
			return 'q4';
		}

		function getMonthIndexesByFilter(labels, filterMode) {
			const monthLabels = Array.isArray(labels) ? labels : [];
			const activeFilter = filterMode || 'all';
			const indexes = monthLabels.reduce(function(result, label, index) {
				const isClosed = isChartMonthClosed(label);
				const quarterKey = getChartQuarterKey(label);
				if (/^month-\d+$/.test(activeFilter) && index !== Number(activeFilter.split('-')[1])) {
					return result;
				}
				if (activeFilter === 'closed' && !isClosed) {
					return result;
				}
				if (activeFilter === 'open' && isClosed) {
					return result;
				}
				if (/^q[1-4]$/.test(activeFilter) && quarterKey !== activeFilter) {
					return result;
				}
				result.push(index);
				return result;
			}, []);

			return indexes.length ? indexes : monthLabels.map(function(label, index) { return index; });
		}

		function pickValuesByIndexes(values, indexes) {
			return (indexes || []).map(function(index) {
				return values[index];
			});
		}

		function pickDataSeriesByIndexes(dataSeries, indexes) {
			const filtered = {};
			Object.keys(dataSeries || {}).forEach(function(key) {
				filtered[key] = pickValuesByIndexes(dataSeries[key] || [], indexes || []);
			});
			return filtered;
		}

		function filterChartSeriesByMonth(labels, dataSeries, filterMode) {
			const visibleIndexes = getMonthIndexesByFilter(labels || [], filterMode);
			const filtered = pickDataSeriesByIndexes(dataSeries, visibleIndexes);
			filtered.labels = pickValuesByIndexes(labels || [], visibleIndexes);
			return filtered;
		}

		var CHART_MONTH_FILTERS = {
			all: { label: 'VĹˇetky', suffix: 'ZobrazenĂ© sĂş vĹˇetky mesiace obchodnĂ©ho roka.' },
			q1: { label: 'Q1', suffix: 'ZobrazenĂ˝ je 1. kvartĂˇl obchodnĂ©ho roka: marec aĹľ mĂˇj.' },
			q2: { label: 'Q2', suffix: 'ZobrazenĂ˝ je 2. kvartĂˇl obchodnĂ©ho roka: jĂşn aĹľ august.' },
			q3: { label: 'Q3', suffix: 'ZobrazenĂ˝ je 3. kvartĂˇl obchodnĂ©ho roka: september aĹľ november.' },
			q4: { label: 'Q4', suffix: 'ZobrazenĂ˝ je 4. kvartĂˇl obchodnĂ©ho roka: december aĹľ februĂˇr.' },
			open: { label: 'OtvorenĂ©', suffix: 'ZobrazenĂ© sĂş len otvorenĂ© mesiace.' },
			closed: { label: 'UzavretĂ©', suffix: 'ZobrazenĂ© sĂş len uzavretĂ© mesiace.' },
		};

		function getThemeColor(variableName, fallback) {
			var value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
			return value || fallback;
		}

		function drawRoundedRect(ctx, x, y, width, height, radius) {
			var safeRadius = Math.min(radius, width / 2, height / 2);
			ctx.beginPath();
			ctx.moveTo(x + safeRadius, y);
			ctx.lineTo(x + width - safeRadius, y);
			ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
			ctx.lineTo(x + width, y + height - safeRadius);
			ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
			ctx.lineTo(x + safeRadius, y + height);
			ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
			ctx.lineTo(x, y + safeRadius);
			ctx.quadraticCurveTo(x, y, x + safeRadius, y);
			ctx.closePath();
		}

		function escapeHtml(value) {
			return String(value == null ? '' : value)
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#39;');
		}

		/**
		 * Net hours formula components. Each entry: [metricName, sign, weight].
		 * Mirrors server-side calculateNetHoursFromGetter_ in code.gs.
		 * sign: -1 = subtracted, +1 = added. weight: multiplier (studentBonus uses 0.5).
		 */
		var NET_HOURS_COMPONENTS = [
			['DlhodobĂˇ neprĂ­tomnosĹĄ (33+ dnĂ­) (b)', -1, 1],
			['Dovolenka (-)', -1, 1],
			['PN KrĂˇtkodobĂ©', -1, 1],
			['Odmena za dohodu', +1, 1],
			['ExternĂˇ pracovnĂˇ agentĂşra (+) Reinigung', +1, 1],
			['ExternĂˇ pracovnĂˇ agentĂşra (+) WareneinrĂ¤umung', +1, 1],
			['Odmena za pr.prĂˇcu Ĺľiak (+) 50%', +1, 0.5],
			['NadÄŤasy (+)', +1, 1],
			['Saldo DF (+)', +1, 1],
			['Saldo DF (-)', +1, 1],
			['Plat sviatky', -1, 1],
		];

		/**
		 * Compute net hours delta from component deltas.
		 * @param {number} structureDelta - Change in structure hours
		 * @param {function(string):number} getComponentDelta - Returns delta for a given metric name
		 * @returns {number}
		 */
		function computeNetHoursDelta(structureDelta, getComponentDelta) {
			var total = structureDelta;
			for (var i = 0; i < NET_HOURS_COMPONENTS.length; i++) {
				var comp = NET_HOURS_COMPONENTS[i];
				total += comp[1] * comp[2] * getComponentDelta(comp[0]);
			}
			return total;
		}

		return {
			normalizeMetricName: normalizeMetricName,
			hasActualRealValue: hasActualRealValue,
			getActualRealValue: getActualRealValue,
			parseChartMonthLabel: parseChartMonthLabel,
			isChartMonthClosed: isChartMonthClosed,
			getChartQuarterKey: getChartQuarterKey,
			getMonthIndexesByFilter: getMonthIndexesByFilter,
			pickValuesByIndexes: pickValuesByIndexes,
			pickDataSeriesByIndexes: pickDataSeriesByIndexes,
			filterChartSeriesByMonth: filterChartSeriesByMonth,
			CHART_MONTH_FILTERS: CHART_MONTH_FILTERS,
			getThemeColor: getThemeColor,
			drawRoundedRect: drawRoundedRect,
			escapeHtml: escapeHtml,
			NET_HOURS_COMPONENTS: NET_HOURS_COMPONENTS,
			computeNetHoursDelta: computeNetHoursDelta,
		};
	})();
