			const THEME_STORAGE_KEY = 'proDashboardThemeMode';

			const state = {
				loginValue: '',
				dashboard: null,
				previewDashboard: null,
				charts: {},
				pendingAdjustments: {},
				pendingWeeklyAdjustments: {},
				weeklyOverridesCache: {},
				weeklyOverridesLoading: {},
				metricNotesCache: {},
				metricNotesLoading: {},
				pendingNotes: {},
				vklNoteScopeMode: 'scope',
				collapsedMetrics: {},
				autoSaveTimer: null,
				saveStatusTimer: null,
				activeNoteMetric: '',
				themeMode: 'light',
				dotFieldController: null,
				topBarCollapsed: true,
				selectedMonth: '',
				selectedChartCollapsed: false,
				selectedTableView: 'monthly',
				selectedMetric: 'ALL',
				rowLayerVisibility: {
					plan: true,
					real: true,
					forecast: true,
					delta: true,
					recommendation: true,
					special: true,
				},
				selectedChartMode: 'obrat',
				selectedChartMonthFilter: 'all',
				structureMixCompareMode: 'both',
				loading: {
					active: false,
					action: '',
				},
			};

			const CHART_MODES = {
				obrat: {
					label: 'Obrat',
					title: 'Obrat GJ 2026',
					subtitle: 'RoÄŤnĂ˝ PlĂˇn, IST a Ăšprava VOD za celĂ˝ obchodnĂ˝ rok.',
				},
				hours: {
					label: 'Hodiny netto',
					title: 'Hodiny netto GJ 2026',
					subtitle: 'RoÄŤnĂ˝ PlĂˇn, IST a Ăšprava VOD naprieÄŤ celĂ˝m rokom.',
				},
				workforce: {
					label: 'Ĺ truktĂşra hodĂ­n',
					title: 'Ĺ truktĂşra hodĂ­n GJ 2026',
					subtitle: 'RoÄŤnĂ˝ PlĂˇn, IST a aktuĂˇlna Ăşprava ĹˇtruktĂşry hodĂ­n v jednom grafe.',
				},
				performance: {
					label: 'ÄŚistĂ˝ vĂ˝kon',
					title: 'ÄŚistĂ˝ vĂ˝kon GJ 2026',
					subtitle: 'RoÄŤnĂ˝ PlĂˇn, IST a Ăšprava VOD ÄŤistĂ©ho vĂ˝konu za celĂ˝ rok.',
				},
			};

			const TABLE_VIEWS = {
				monthly: {
					label: 'MesaÄŤnĂ˝ detail',
					title: 'Ukazovatele po Mesiacoch',
					description: 'Detail po mesiacoch s rozbalenĂ­m vrstiev, Ăşprav VOD a poznĂˇmok.',
				},
				weekly: {
					label: 'TĂ˝ĹľdennĂ˝ kompakt',
					title: 'TĂ˝ĹľdennĂ˝ prehÄľad ukazovateÄľov',
					description: 'VybranĂ˝ mesiac sa rozloĹľĂ­ rovnomerne do kalendĂˇrnych tĂ˝ĹľdĹov a pravĂ˝ stÄşpec ostĂˇva mesaÄŤnĂ˝.',
				},
			};

			const ROW_LAYER_CONTROLS = [
				{ key: 'plan', label: 'PlĂˇn', meta: 'RoÄŤnĂ˝ zĂˇklad', icon: 'calendar', title: 'ZobraziĹĄ alebo skryĹĄ planovĂ© riadky.' },
				{ key: 'real', label: 'IST', meta: 'SkutoÄŤnosĹĄ', icon: 'pulse', title: 'ZobraziĹĄ alebo skryĹĄ IST riadky.' },
				{ key: 'forecast', label: 'Ăšprava VOD', meta: 'Predikcia', icon: 'spark', title: 'ZobraziĹĄ alebo skryĹĄ predikciu alebo Ăşpravu VOD.' },
				{ key: 'delta', label: 'Delta', meta: 'OdchĂ˝lka', icon: 'delta', title: 'ZobraziĹĄ alebo skryĹĄ delta riadky.' },
				{ key: 'recommendation', label: 'OdporĂşÄŤ.', meta: 'NĂˇvrh', icon: 'wand', title: 'ZobraziĹĄ alebo skryĹĄ odporĂşÄŤania a predpokladanĂ˝ vĂ˝sledok.' },
				{ key: 'special', label: 'PomocnĂ©', meta: 'Doplnky', icon: 'layers', title: 'ZobraziĹĄ alebo skryĹĄ ĹˇpeciĂˇlne pomocnĂ© riadky.' },
			];

			TABLE_VIEWS.monthly.icon = 'table';
			TABLE_VIEWS.monthly.meta = 'Po mesiacoch';
			TABLE_VIEWS.weekly.icon = 'split';
			TABLE_VIEWS.weekly.meta = 'Po tĂ˝ĹľdĹoch';

			const currencyFormatter = new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
			const numberFormatter = new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 1 });
			const {
				normalizeMetricName,
				hasActualRealValue,
				getActualRealValue,
				parseChartMonthLabel,
				isChartMonthClosed,
				getChartQuarterKey,
				getMonthIndexesByFilter,
				pickValuesByIndexes,
				pickDataSeriesByIndexes,
				filterChartSeriesByMonth,
				CHART_MONTH_FILTERS,
				getThemeColor,
				drawRoundedRect,
				escapeHtml,
				computeNetHoursDelta,
			} = window.ProDashboardShared;

			function drawChartValueBadge(ctx, text, x, y, options) {
				const config = options || {};
				const font = config.font || '700 10px IBM Plex Sans';
				ctx.save();
				ctx.font = font;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				const textWidth = ctx.measureText(text).width;
				const horizontalPadding = config.horizontalPadding != null ? config.horizontalPadding : 8;
				const verticalPadding = config.verticalPadding != null ? config.verticalPadding : 5;
				const height = config.height != null ? config.height : 22;
				const width = textWidth + (horizontalPadding * 2);
				const left = x - (width / 2);
				const top = y - (height / 2);

				drawRoundedRect(ctx, left, top, width, height, config.radius != null ? config.radius : 999);
				ctx.fillStyle = config.backgroundColor || getThemeColor('--badge-bg', 'rgba(255, 255, 255, 0.98)');
				ctx.fill();

				if (config.borderColor) {
					ctx.lineWidth = config.borderWidth != null ? config.borderWidth : 1;
					ctx.strokeStyle = config.borderColor;
					ctx.stroke();
				}

				ctx.fillStyle = config.textColor || getThemeColor('--badge-text', '#0f172a');
				ctx.fillText(text, x, y + (config.textOffsetY || 0));
				ctx.restore();
			}

			const staticValueLabelsPlugin = {
				id: 'staticValueLabels',
				afterDatasetsDraw: function(chart, args, pluginOptions) {
					if (!pluginOptions || pluginOptions.display === false) {
						return;
					}

					const visibleMetas = chart.getSortedVisibleDatasetMetas();
					if (!visibleMetas.length) {
						return;
					}

					const ctx = chart.ctx;
					const defaultFormat = pluginOptions.format || 'number';
					const chartTop = chart.chartArea ? chart.chartArea.top : 0;
					const chartBottom = chart.chartArea ? chart.chartArea.bottom : chart.height;

					ctx.save();

					visibleMetas.forEach(function(meta, visibleIndex) {
						const dataset = chart.data.datasets[meta.index];
						if (!chart.isDatasetVisible(meta.index)) {
							return;
						}

						meta.data.forEach(function(element, dataIndex) {
							const rawValue = dataset.data[dataIndex];
							if (rawValue === null || rawValue === undefined || rawValue === '') {
								return;
							}

							const props = typeof element.getProps === 'function'
								? element.getProps(['x', 'y', 'base'], true)
								: (typeof element.tooltipPosition === 'function' ? element.tooltipPosition() : { x: 0, y: 0, base: 0 });
							const isBar = (dataset.type || meta.type) === 'bar';
							const stackOffset = isBar ? 0 : (visibleMetas.length - visibleIndex - 1) * 18;
							const formattedValue = formatChartValueLabel(rawValue, dataset.valueFormat || defaultFormat);
							let badgeX = props.x;
							let badgeY;

							if (isBar) {
								const barHeight = Math.abs(Number(props.base || 0) - Number(props.y || 0));
								const topEdge = Math.min(Number(props.base || 0), Number(props.y || 0));
								badgeY = barHeight >= 34
									? topEdge + 14 + stackOffset
									: topEdge - 14 - stackOffset;
							} else {
								badgeY = Number(props.y || 0) - 16 - stackOffset;
							}

							badgeY = Math.max(chartTop + 12, Math.min(chartBottom - 12, badgeY));

							drawChartValueBadge(ctx, formattedValue, badgeX, badgeY, {
								font: isBar ? '700 10px IBM Plex Sans' : '600 10px IBM Plex Sans',
									backgroundColor: getThemeColor('--badge-bg', 'rgba(255, 255, 255, 0.98)'),
									textColor: dataset.labelColor || getThemeColor('--badge-text', '#0f172a'),
									borderColor: dataset.borderColor || getThemeColor('--badge-border', 'rgba(15, 23, 42, 0.18)'),
								borderWidth: 1,
								horizontalPadding: isBar ? 7 : 8,
								verticalPadding: 4,
								height: isBar ? 20 : 22,
							});
						});
					});

					ctx.restore();
				}
			};

			Chart.register(staticValueLabelsPlugin);

			function hexToRgb(color) {
				var normalized = String(color || '').trim().replace('#', '');
				var safe = normalized.length === 3
					? normalized.split('').map(function(part) { return part + part; }).join('')
					: normalized.padEnd(6, '0').slice(0, 6);
				return {
					r: parseInt(safe.slice(0, 2), 16),
					g: parseInt(safe.slice(2, 4), 16),
					b: parseInt(safe.slice(4, 6), 16),
				};
			}

			function mixRgbColors(left, right, ratio) {
				var weight = Math.max(0, Math.min(1, Number(ratio || 0)));
				var inverse = 1 - weight;
				return {
					r: Math.round(left.r * inverse + right.r * weight),
					g: Math.round(left.g * inverse + right.g * weight),
					b: Math.round(left.b * inverse + right.b * weight),
				};
			}

			function rgbaString(rgb, alpha) {
				return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + alpha + ')';
			}

			function resolveInitialThemeMode() {
				try {
					return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
				} catch (error) {
					return 'light';
				}
			}

			function updateThemeToggleUi() {
				var toggles = document.querySelectorAll('[data-theme-toggle="mode"]');
				if (!toggles.length) {
					return;
				}
				var isDark = state.themeMode === 'dark';
				toggles.forEach(function(toggle) {
					toggle.setAttribute('aria-checked', isDark ? 'true' : 'false');
					toggle.setAttribute('data-theme-mode', isDark ? 'dark' : 'light');
					toggle.classList.toggle('is-active', isDark);
					toggle.setAttribute('title', isDark ? 'PrepnĂşĹĄ na svetlĂ˝ reĹľim' : 'PrepnĂşĹĄ na tmavĂ˝ reĹľim');
				});
			}

			function getToggleIconMarkup(iconKey) {
				switch (String(iconKey || '')) {
					case 'table':
						return '<svg class="chart-mode-button__icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14.5" rx="2"></rect><path d="M3.5 10h17"></path><path d="M9 5v14.5"></path></svg>';
					case 'split':
						return '<svg class="chart-mode-button__icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14.5" rx="2"></rect><path d="M12 5v14.5"></path><path d="M8 9.5h.01"></path><path d="M8 14.5h.01"></path><path d="M16 9.5h.01"></path><path d="M16 14.5h.01"></path></svg>';
					case 'calendar':
						return '<svg class="chart-mode-button__icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"></rect><path d="M7.5 3.5v3"></path><path d="M16.5 3.5v3"></path><path d="M3.5 9.5h17"></path></svg>';
					case 'pulse':
						return '<svg class="chart-mode-button__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12h4l2-4 4.2 8 2.1-4h4.7"></path></svg>';
					case 'spark':
						return '<svg class="chart-mode-button__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l1.7 4.8L18.5 10l-4.8 1.7L12 16.5l-1.7-4.8L5.5 10l4.8-1.7z"></path></svg>';
					case 'delta':
						return '<svg class="chart-mode-button__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5l7.5 14h-15z"></path></svg>';
					case 'wand':
						return '<svg class="chart-mode-button__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 19.5l8-8"></path><path d="M13.5 4.5l.8 2.1 2.2.8-2.2.8-.8 2.1-.8-2.1-2.2-.8 2.2-.8z"></path><path d="M16.8 13l.5 1.3 1.4.5-1.4.5-.5 1.3-.5-1.3-1.4-.5 1.4-.5z"></path></svg>';
					case 'layers':
						return '<svg class="chart-mode-button__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5l8 4.2-8 4.3-8-4.3z"></path><path d="M4 12.8l8 4.2 8-4.2"></path></svg>';
					default:
						return '<svg class="chart-mode-button__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"></circle></svg>';
				}
			}

			function renderIconToggleButton(className, dataAttributeName, dataAttributeValue, label, meta, icon, title, isActive) {
				return '<button class="' + className + '" type="button" ' + dataAttributeName + '="' + escapeHtml(dataAttributeValue) + '" aria-pressed="' + (isActive ? 'true' : 'false') + '" title="' + escapeHtml(title || label) + '">'
					+ '<span class="chart-mode-button__icon-wrap">' + getToggleIconMarkup(icon) + '</span>'
					+ '<span class="chart-mode-button__copy"><span class="chart-mode-button__label">' + escapeHtml(label) + '</span>'
					+ (meta ? '<span class="chart-mode-button__meta">' + escapeHtml(meta) + '</span>' : '')
					+ '</span></button>';
			}

			function applyThemeMode(mode, options) {
				var config = options || {};
				var normalized = mode === 'dark' ? 'dark' : 'light';
				state.themeMode = normalized;
				document.body.classList.toggle('theme-dark', normalized === 'dark');
				updateThemeToggleUi();

				if (config.persist !== false) {
					try {
						window.localStorage.setItem(THEME_STORAGE_KEY, normalized);
					} catch (error) {
						// Ignore storage failures in restricted environments.
					}
				}

				if (state.dotFieldController && typeof state.dotFieldController.updatePalette === 'function') {
					state.dotFieldController.updatePalette();
				}

				if (config.rerender === false) {
					return;
				}

				var payload = getActiveDashboard();
				if (payload) {
					renderTopWidgets(payload);
					renderCharts(payload);
					renderMetricTable(payload);
				}
			}

			function toggleThemeMode() {
				applyThemeMode(state.themeMode === 'dark' ? 'light' : 'dark');
			}

			function readDotFieldPalette() {
				var styles = getComputedStyle(document.body);
				return {
					colorFrom: hexToRgb((styles.getPropertyValue('--dot-from') || '#154c79').trim()),
					colorTo: hexToRgb((styles.getPropertyValue('--dot-to') || '#2b7b76').trim()),
					glowColor: hexToRgb((styles.getPropertyValue('--dot-glow') || '#12212e').trim()),
				};
			}

			function initializeDotFieldBackground() {
				var canvas = document.getElementById('dotFieldCanvas');
				if (!canvas || !canvas.getContext) {
					return;
				}

				var context = canvas.getContext('2d');
				if (!context) {
					return;
				}

				var pointer = { x: -9999, y: -9999, active: false };
				var width = 0;
				var height = 0;
				var frame = 0;
				var spacing = 14;
				var baseRadius = 1.5;
				var bulgeStrength = 67;
				var cursorRadius = 500;
				var cursorForce = 0.1;
				var glowRadius = 160;
				var media = window.matchMedia ? {
					coarsePointer: window.matchMedia('(pointer: coarse)'),
					reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)')
				} : null;
				var useStaticMode = Boolean(
					media && (
						(media.coarsePointer && media.coarsePointer.matches) ||
						(media.reducedMotion && media.reducedMotion.matches)
					)
				);
				var dynamicSpacing = useStaticMode ? 18 : spacing;
				var dynamicCursorForce = useStaticMode ? 0 : cursorForce;
				var dynamicGlowRadius = useStaticMode ? glowRadius * 0.72 : glowRadius;
				var latestPointerEvent = null;
				var pointerUpdateFrame = 0;
				var palette = readDotFieldPalette();
				var colorFrom = palette.colorFrom;
				var colorTo = palette.colorTo;
				var glowColor = palette.glowColor;

				function updatePalette() {
					var nextPalette = readDotFieldPalette();
					colorFrom = nextPalette.colorFrom;
					colorTo = nextPalette.colorTo;
					glowColor = nextPalette.glowColor;
				}

				function resizeCanvas() {
					var bounds = canvas.getBoundingClientRect();
					var ratio = window.devicePixelRatio || 1;
					width = bounds.width;
					height = bounds.height;
					canvas.width = Math.round(width * ratio);
					canvas.height = Math.round(height * ratio);
					context.setTransform(ratio, 0, 0, ratio, 0, 0);
				}

				function renderFrame() {
					context.clearRect(0, 0, width, height);

					var glowGradient = context.createRadialGradient(
						pointer.active ? pointer.x : width * 0.3,
						pointer.active ? pointer.y : height * 0.18,
						0,
						pointer.active ? pointer.x : width * 0.3,
						pointer.active ? pointer.y : height * 0.18,
						pointer.active ? dynamicGlowRadius : dynamicGlowRadius * 1.4
					);
					glowGradient.addColorStop(0, rgbaString(glowColor, pointer.active ? 0.14 : 0.08));
					glowGradient.addColorStop(1, rgbaString(glowColor, 0));
					context.fillStyle = glowGradient;
					context.fillRect(0, 0, width, height);

					var columns = Math.ceil(width / dynamicSpacing) + 2;
					var rows = Math.ceil(height / dynamicSpacing) + 2;
					for (var row = -1; row < rows; row += 1) {
						for (var col = -1; col < columns; col += 1) {
							var baseX = col * dynamicSpacing;
							var baseY = row * dynamicSpacing;
							var dx = baseX - pointer.x;
							var dy = baseY - pointer.y;
							var distance = Math.sqrt(dx * dx + dy * dy);
							var proximity = pointer.active ? Math.max(0, 1 - distance / cursorRadius) : 0;
							var bulge = proximity * bulgeStrength * dynamicCursorForce;
							var safeDistance = distance || 1;
							var x = baseX + (pointer.active ? (dx / safeDistance) * bulge : 0);
							var y = baseY + (pointer.active ? (dy / safeDistance) * bulge : 0);
							var mixRatio = height > 0 ? Math.max(0, Math.min(1, (y + x * 0.12) / (height + width * 0.12))) : 0;
							var color = mixRgbColors(colorFrom, colorTo, mixRatio);
							var alpha = 0.18 + proximity * 0.45;
							var radius = baseRadius + proximity * 1.6;

							context.beginPath();
							context.fillStyle = rgbaString(color, alpha);
							context.arc(x, y, radius, 0, Math.PI * 2);
							context.fill();
						}
					}

					frame = window.requestAnimationFrame(renderFrame);
				}

				function applyPointerPosition(event) {
					pointer.x = event.clientX;
					pointer.y = event.clientY;
					pointer.active = !useStaticMode;
				}

				function queuePointerPosition(event) {
					if (useStaticMode || (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen')) {
						return;
					}

					latestPointerEvent = event;
					if (pointerUpdateFrame) {
						return;
					}

					pointerUpdateFrame = window.requestAnimationFrame(function() {
						pointerUpdateFrame = 0;
						if (latestPointerEvent) {
							applyPointerPosition(latestPointerEvent);
						}
					});
				}

				function resetPointer() {
					pointer.x = -9999;
					pointer.y = -9999;
					pointer.active = false;
					latestPointerEvent = null;
					if (pointerUpdateFrame) {
						window.cancelAnimationFrame(pointerUpdateFrame);
						pointerUpdateFrame = 0;
					}
				}

				window.addEventListener('resize', resizeCanvas);
				window.addEventListener('pointermove', queuePointerPosition, { passive: true });
				window.addEventListener('pointerleave', resetPointer);
				window.addEventListener('pointercancel', resetPointer);

				resizeCanvas();
				renderFrame();

				return {
					updatePalette: updatePalette,
				};
			}

			state.themeMode = resolveInitialThemeMode();
			applyThemeMode(state.themeMode, { rerender: false, persist: false });
			state.dotFieldController = initializeDotFieldBackground();

			document.getElementById('loginButton').addEventListener('click', handleLogin);
			document.getElementById('summaryButton').addEventListener('click', openSummaryView);
			document.getElementById('loginInput').addEventListener('keydown', function(event) {
				if (event.key === 'Enter') {
					handleLogin();
				}
			});
			document.getElementById('refreshButton').addEventListener('click', function() {
				loadDashboard(document.getElementById('scopeSelect').value || 'ALL');
			});
			document.getElementById('logoutButton').addEventListener('click', handleLogout);
			document.getElementById('saveFabButton').addEventListener('click', saveAdjustments);
			document.getElementById('collapseAllMetricsButton').addEventListener('click', function() {
				setAllFilteredMetricsCollapsed(true);
			});
			document.getElementById('expandAllMetricsButton').addEventListener('click', function() {
				setAllFilteredMetricsCollapsed(false);
			});
			document.getElementById('menuToggleButton').addEventListener('click', toggleTopBar);
			document.querySelectorAll('[data-theme-toggle="mode"]').forEach(function(toggle) {
				toggle.addEventListener('click', toggleThemeMode);
			});
			document.getElementById('scopeNotesButton').addEventListener('click', function() {
				state.topBarCollapsed = true;
				updateTopBarState();
				openNoteModal();
			});
			document.getElementById('saveButton').addEventListener('click', saveAdjustments);
			document.getElementById('recalcButton').addEventListener('click', handleManualRecalculate);
			document.getElementById('topbarToggle').addEventListener('click', toggleTopBar);
			document.getElementById('sidebarBackdrop').addEventListener('click', function() {
				state.topBarCollapsed = true;
				updateTopBarState();
			});
			document.getElementById('noteModalClose').addEventListener('click', closeNoteModal);
			document.getElementById('noteModalSave').addEventListener('click', saveAdjustments);
			document.getElementById('noteModalBackdrop').addEventListener('click', function(event) {
				if (event.target === this) {
					closeNoteModal();
				}
			});
			document.getElementById('scopeSelect').addEventListener('change', function() {
				loadDashboard(this.value);
			});

			document.addEventListener('click', function(event) {
				var btn = event.target.closest('.breakdown-show-more-btn');
				if (!btn) { return; }
				var panel = btn.closest('.breakdown-panel');
				if (!panel) { return; }
				panel.querySelectorAll('.breakdown-hidden-row').forEach(function(row) {
					row.classList.remove('breakdown-hidden-row');
				});
				btn.closest('.breakdown-show-more').remove();
			});
			document.getElementById('monthSelect').addEventListener('change', function() {
				state.selectedMonth = this.value;
				normalizeSelectedMonthForCurrentView(getActiveDashboard());
				preloadWeeklyOverrides(getActiveDashboard());
				renderTopWidgets(getActiveDashboard());
				renderMetricTable(getActiveDashboard());
			});
			document.getElementById('metricSelect').addEventListener('change', function() {
				state.selectedMetric = this.value;
				renderMetricTable(getActiveDashboard());
			});
			document.getElementById('tableViewControls').addEventListener('click', function(event) {
				const button = event.target.closest('[data-table-view]');
				if (!button) {
					return;
				}

				state.selectedTableView = button.dataset.tableView;
				const payload = getActiveDashboard();
				if (!payload) {
					return;
				}

				normalizeSelectedMonthForCurrentView(payload);
				renderTopWidgets(payload);
				renderMetricTable(payload);
			});
			document.getElementById('rowVisibilityControls').addEventListener('click', function(event) {
				const button = event.target.closest('[data-row-layer]');
				if (!button) {
					return;
				}

				toggleRowLayerVisibility(button.dataset.rowLayer);
			});
			document.getElementById('chartModeControls').addEventListener('click', function(event) {
				const button = event.target.closest('[data-chart-mode]');
				if (!button) {
					return;
				}

				state.selectedChartMode = button.dataset.chartMode;
				renderCharts(getActiveDashboard());
			});
			document.getElementById('chartCollapseButton').addEventListener('click', function() {
				state.selectedChartCollapsed = !state.selectedChartCollapsed;
				updateChartPanelState();
				if (!state.selectedChartCollapsed) {
					renderCharts(getActiveDashboard());
				}
			});
			document.getElementById('chartMonthFilterControls').addEventListener('click', function(event) {
				const button = event.target.closest('[data-chart-month-filter]');
				if (!button) {
					return;
				}

				state.selectedChartMonthFilter = button.dataset.chartMonthFilter;
				renderHero(getActiveDashboard());
				renderCharts(getActiveDashboard());
			});
			document.addEventListener('keydown', function(event) {
				if (event.key === 'Escape' && !state.topBarCollapsed) {
					state.topBarCollapsed = true;
					updateTopBarState();
				}
			});

			const initialLogin = new URLSearchParams(window.location.search).get('login') || '';
			if (initialLogin) {
				document.getElementById('loginInput').value = initialLogin;
				state.loginValue = initialLogin;
				loadDashboard('ALL');
			}

			let responsiveLayoutTimer = null;
			window.addEventListener('resize', scheduleResponsiveRefresh);
			if (window.visualViewport) {
				window.visualViewport.addEventListener('resize', scheduleResponsiveRefresh);
			}

			function scheduleResponsiveRefresh() {
				if (responsiveLayoutTimer) {
					clearTimeout(responsiveLayoutTimer);
				}

				responsiveLayoutTimer = setTimeout(function() {
					responsiveLayoutTimer = null;
					const payload = getActiveDashboard();
					if (!payload) {
						return;
					}
					renderTopWidgets(payload);
					renderCharts(payload);
					renderMetricTable(payload);
				}, 120);
			}

			function handleLogin() {
				const loginValue = document.getElementById('loginInput').value.trim();
				if (!loginValue) {
					showLoginError('Zadaj email alebo test identifikĂˇtor.');
					return;
				}
				state.loginValue = loginValue;
				hideLoginError();
				loadDashboard('ALL');
			}

			function openSummaryView() {
				google.script.run
					.withSuccessHandler(function(appUrl) {
						navigateToAppView(appUrl, 'sumar');
					})
					.withFailureHandler(function() {
						navigateToAppView('', 'sumar');
					})
					.getWebAppUrl();
			}

			function openTestLabView() {
				google.script.run
					.withSuccessHandler(function(appUrl) {
						var baseUrl = appUrl || window.location.href;
						var url = new URL(baseUrl);
						url.search = '';
						url.searchParams.set('view', 'test');
						window.open(url.toString(), '_blank');
					})
					.withFailureHandler(function() {
						var url = new URL(window.top.location.href);
						url.search = '';
						url.searchParams.set('view', 'test');
						window.open(url.toString(), '_blank');
					})
					.getWebAppUrl();
			}

			function handleLogout() {
				if (!state.dashboard || !hasPendingDashboardChanges()) {
					navigateToLogin();
					return;
				}

				hideSaveStatus();
				saveDashboardChanges_({
					silent: true,
					includeAdjustments: true,
					includeNotes: true,
					autoSave: false,
					skipReloadOnSuccess: true,
					onSuccess: function() {
						navigateToLogin();
					},
					onFailure: function(error) {
						alert((error && error.message) ? error.message : 'Nepodarilo sa uloĹľiĹĄ zmeny pred odhlĂˇsenĂ­m.');
					}
				});
			}

			function navigateToLogin() {
				google.script.run
					.withSuccessHandler(function(appUrl) {
						navigateToAppView(appUrl, '');
					})
					.withFailureHandler(function() {
						navigateToAppView('', '');
					})
					.getWebAppUrl();
			}

			function navigateToAppView(appUrl, view) {
				const baseUrl = appUrl || window.location.href;
				const url = new URL(baseUrl);
				url.search = '';
				if (view) {
					url.searchParams.set('view', view);
				}
				window.top.location.href = url.toString();
			}

			function loadDashboard(selectedScope, options) {
				const config = options || {};
				if (!config.silent) {
					setLoadingState(true, {
						action: 'load',
						title: 'NaÄŤĂ­tavam dashboard',
						subtitle: 'SĹĄahujem dĂˇta z Google Sheets a pripravujem vizualizĂˇcie.',
					});
				}
				google.script.run
					.withSuccessHandler(function(payload) {
						state.vklNoteScopeMode = resolveVklNoteScopeMode(payload, state.vklNoteScopeMode);
						if (!config.preservePending) {
							state.pendingAdjustments = {};
							state.pendingWeeklyAdjustments = {};
							state.weeklyOverridesCache = {};
							state.weeklyOverridesLoading = {};
							state.metricNotesCache = {};
							state.metricNotesLoading = {};
							state.pendingNotes = {};
						}
						state.dashboard = payload;
						state.previewDashboard = null;
						state.activeNoteMetric = '';
						closeNoteModal();
						renderDashboard(state.dashboard);
						if (!config.silent) {
							setLoadingState(false);
						}
					})
					.withFailureHandler(function(error) {
						if (!config.silent) {
							setLoadingState(false);
						}
						if (!state.dashboard) {
							showLoginError(error.message || 'Nepodarilo sa naÄŤĂ­taĹĄ dashboard.');
							return;
						}
						if (!config.silent) {
							alert(error.message || 'Nepodarilo sa naÄŤĂ­taĹĄ dashboard.');
						}
					})
					.getDashboardData(state.loginValue, selectedScope);
			}

			function renderDashboard(payload) {
				document.getElementById('loginShell').classList.add('hidden');
				document.getElementById('appShell').style.display = 'grid';

				updateTopBarState();
				renderIdentity(payload);
				updateRecalcButtonVisibility(payload);
				renderScopeSelect(payload);
				renderMetricSelect(payload);
				renderTopWidgets(payload);
				renderCharts(payload);
				preloadWeeklyOverrides(payload);
				renderMetricTable(payload);
				renderScopeNotesIndicator();
				ensureMetricNotesLoaded(GLOBAL_SCOPE_NOTE_KEY);
			}

			function renderTopWidgets(payload) {
				renderMonthSelect(payload);
				renderHero(payload);
			}

			function getActiveDashboard() {
				return state.previewDashboard || state.dashboard;
			}

			function isWorkforceStructureMetric(metric) {
				return normalizeMetricName(metric) === normalizeMetricName('Ĺ truktĂşra filiĂˇlky (plnĂ© ĂşvĂ¤zky)');
			}

			function getStructureMixCompareMode() {
				return state.structureMixCompareMode || 'both';
			}

			function renderStructureCompareToggle() {
				const compareModes = [
					{ key: 'none', label: 'VOD' },
					{ key: 'plan', label: 'vs PLĂN' },
					{ key: 'ist', label: 'vs IST' },
					{ key: 'both', label: 'vs IST a PLĂN' },
				];
				const activeMode = getStructureMixCompareMode();
				return '<div class="structure-compare-toggle"><span class="structure-compare-toggle-label">Porovnanie</span>'
					+ compareModes.map(function(mode) {
						return '<button class="structure-compare-button' + (mode.key === activeMode ? ' is-active' : '') + '" type="button" data-structure-compare-mode="' + escapeHtml(mode.key) + '">' + escapeHtml(mode.label) + '</button>';
					}).join('')
					+ '</div>';
			}

			function setStructureMixCompareMode(mode) {
				state.structureMixCompareMode = mode || 'both';
				if (hasPendingAdjustmentChanges()) {
					refreshLocalPreview();
					return;
				}
				renderMetricTable(getActiveDashboard());
			}

			function getMetricCollapseKey(metric) {
				return normalizeMetricName(metric);
			}

			function isMetricCollapsed(metric) {
				return Boolean(state.collapsedMetrics[getMetricCollapseKey(metric)]);
			}

			function getFilteredMetricSections(payload) {
				if (!payload || !Array.isArray(payload.table)) {
					return [];
				}

				return payload.table.filter(function(section) {
					if (normalizeMetricName(section.metric) === normalizeMetricName('Ĺ truktĂşra hodĂ­n')) {
						return false;
					}

					return state.selectedMetric === 'ALL' || normalizeMetricName(section.metric) === normalizeMetricName(state.selectedMetric);
				});
			}

			function getWeeklyCompactMetricSections(payload) {
				const hiddenMetrics = [
					normalizeMetricName('Hodiny Brutto GJ2026'),
					normalizeMetricName('Ĺ truktĂşra hodĂ­n'),
					normalizeMetricName('Ĺ truktĂşra filiĂˇlky (plnĂ© ĂşvĂ¤zky)'),
				];
				const priorityMetrics = [
					normalizeMetricName('Hodiny netto'),
					normalizeMetricName('Obrat GJ2026'),
					normalizeMetricName('ÄŚistĂ˝ vĂ˝kon'),
				];
				return getFilteredMetricSections(payload)
					.filter(function(section) {
						return hiddenMetrics.indexOf(normalizeMetricName(section.metric)) === -1;
					})
					.sort(function(left, right) {
						const leftMetric = normalizeMetricName(left.metric);
						const rightMetric = normalizeMetricName(right.metric);
						const leftPriority = priorityMetrics.indexOf(leftMetric);
						const rightPriority = priorityMetrics.indexOf(rightMetric);

						if (leftPriority === -1 && rightPriority === -1) {
							return 0;
						}
						if (leftPriority === -1) {
							return 1;
						}
						if (rightPriority === -1) {
							return -1;
						}
						return leftPriority - rightPriority;
					});
			}

			function toggleMetricCollapsed(metric) {
				const key = getMetricCollapseKey(metric);
				state.collapsedMetrics[key] = !state.collapsedMetrics[key];
				const payload = getActiveDashboard();
				if (payload) {
					renderMetricTable(payload);
				}
			}

			function setAllFilteredMetricsCollapsed(collapsed) {
				const payload = getActiveDashboard();
				if (!payload) {
					return;
				}

				getFilteredMetricSections(payload).forEach(function(section) {
					state.collapsedMetrics[getMetricCollapseKey(section.metric)] = collapsed;
				});

				renderMetricTable(payload);
			}

			function renderMetricCollapseControls(payload) {
				const collapseButton = document.getElementById('collapseAllMetricsButton');
				const expandButton = document.getElementById('expandAllMetricsButton');
				const sections = getFilteredMetricSections(payload);
				const hasSections = sections.length > 0;
				const allCollapsed = hasSections && sections.every(function(section) {
					return isMetricCollapsed(section.metric);
				});
				const allExpanded = hasSections && sections.every(function(section) {
					return !isMetricCollapsed(section.metric);
				});

				collapseButton.disabled = !hasSections || allCollapsed;
				expandButton.disabled = !hasSections || allExpanded;
			}

			function toggleTopBar() {
				state.topBarCollapsed = !state.topBarCollapsed;
				updateTopBarState();
			}

			function updateTopBarState() {
				const topBar = document.getElementById('topBar');
				const menuButton = document.getElementById('menuToggleButton');
				const backdrop = document.getElementById('sidebarBackdrop');
				const toggleButton = document.getElementById('topbarToggle');
				topBar.classList.toggle('is-open', !state.topBarCollapsed);
				backdrop.classList.toggle('hidden', state.topBarCollapsed);
				document.body.classList.toggle('sidebar-open', !state.topBarCollapsed);
				menuButton.setAttribute('aria-expanded', state.topBarCollapsed ? 'false' : 'true');
				toggleButton.setAttribute('aria-expanded', state.topBarCollapsed ? 'false' : 'true');
			}

			function renderIdentity(payload) {
				document.getElementById('identityName').textContent = payload.user.displayName;
				document.getElementById('identityMeta').textContent = [
					'Rola: ' + payload.user.role,
					payload.user.gfName ? 'GF: ' + payload.user.gfName : '',
					payload.user.vklName ? 'VKL: ' + payload.user.vklName : '',
				].filter(Boolean).join(' â€˘ ');
				document.getElementById('generatedAt').textContent = 'AktualizovanĂ© ' + payload.generatedAt;
				// statusScope hidden
				document.getElementById('saveHint').textContent = payload.user.role === 'VOD'
					? ''
					: payload.user.role === 'VKL'
						? (payload.scope.type === 'STORE'
							? 'V note modale si vyberieĹˇ, ÄŤi ide VKL poznĂˇmka len pre tĂşto filiĂˇlku alebo pre celĂ˝ VKL.'
							: 'VKL poznĂˇmka sa uloĹľĂ­ pre celĂ˝ aktuĂˇlny VKL scope.')
						: 'Tento pohÄľad je len na ÄŤĂ­tanie. PoznĂˇmky zapisuje VOD alebo VKL.';
			}

			function updateRecalcButtonVisibility(payload) {
				const recalcButton = document.getElementById('recalcButton');
				const saveFabButton = document.getElementById('saveFabButton');
				if (!recalcButton || !saveFabButton) {
					return;
				}

				const canRecalculate = Boolean(payload && payload.user && payload.user.role === 'VOD' && payload.scope && payload.scope.type === 'STORE');
				recalcButton.classList.toggle('hidden', !canRecalculate);
				recalcButton.disabled = !canRecalculate;
				saveFabButton.classList.toggle('hidden', !canRecalculate);
				saveFabButton.disabled = !canRecalculate;
			}

			function renderScopeSelect(payload) {
				const select = document.getElementById('scopeSelect');
				select.innerHTML = payload.scopes.map(function(scope) {
					const selected = scope.id === payload.scope.id ? 'selected' : '';
					return '<option value="' + escapeHtml(scope.id) + '" ' + selected + '>' + escapeHtml(scope.label) + '</option>';
				}).join('');

				document.getElementById('scopeSummary').innerHTML = [
					'<div>AktĂ­vny scope: <strong>' + escapeHtml(payload.scope.label) + '</strong></div>',
					'<div>PoÄŤet filiĂˇlok: <strong>' + payload.scope.storeIds.length + '</strong></div>',
					'<div>ReĹľim: <strong>' + escapeHtml(payload.scope.type) + '</strong></div>'
				].join('');
			}

			function renderMonthSelect(payload) {
				const select = document.getElementById('monthSelect');
				normalizeSelectedMonthForCurrentView(payload);

				select.innerHTML = ['<option value="__YEAR__" ' + (state.selectedMonth === '__YEAR__' ? 'selected' : '') + '>SumĂˇr roka</option>']
					.concat(payload.months.map(function(month) {
					const selected = month === state.selectedMonth ? 'selected' : '';
					return '<option value="' + escapeHtml(month) + '" ' + selected + '>' + escapeHtml(formatMonthShort(month)) + '</option>';
				}))
					.join('');
			}

			function renderMetricSelect(payload) {
				const select = document.getElementById('metricSelect');
				const metrics = payload.table.map(function(section) {
					return section.metric;
				});

				if (state.selectedMetric !== 'ALL' && metrics.indexOf(state.selectedMetric) === -1) {
					state.selectedMetric = 'ALL';
				}

				select.innerHTML = ['<option value="ALL" ' + (state.selectedMetric === 'ALL' ? 'selected' : '') + '>VĹˇetky ukazovatele</option>']
					.concat(metrics.map(function(metric) {
						const selected = metric === state.selectedMetric ? 'selected' : '';
						return '<option value="' + escapeHtml(metric) + '" ' + selected + '>' + escapeHtml(metric) + '</option>';
					}))
					.join('');
			}

			function renderHero(payload) {
				const periodContext = getHeroPeriodContext(payload);
				const periodLabel = periodContext.label;
				const focusWidgets = buildHeroWidgets(payload, periodContext);

				document.getElementById('heroTitle').textContent = payload.scope.type === 'AGGREGATE'
					? 'PRO GJ 2026 ' + payload.user.role
					: 'PRO GJ 2026 ' + payload.scope.label;
				document.getElementById('heroText').textContent = payload.scope.type === 'AGGREGATE'
					? ' ' + periodLabel + '.'
					: 'Detail filiĂˇlky pre ' + periodLabel + '.';

				const periodCards = focusWidgets.filter(function(card) {
					return card.scopeType !== 'year';
				});
				const yearCards = focusWidgets.filter(function(card) {
					return card.scopeType === 'year';
				});

				document.getElementById('heroGrid').innerHTML = [
					renderHeroCardGroup('MesaÄŤnĂ˝ prehÄľad', 'PohÄľad pre ' + periodLabel + '.', 'FiltrovanĂ© obdobie', 'hero-group-grid--period', periodCards),
					renderHeroCardGroup('CelĂ˝ obchodnĂ˝ rok', '', 'RoÄŤnĂ˝ sumĂˇr', 'hero-group-grid--year', yearCards)
				].join('');
			}

			function renderHeroCardGroup(title, caption, chipLabel, gridClass, cards) {
				if (!cards || !cards.length) {
					return '';
				}

				return '<section class="hero-group">'
					+ '<div class="hero-group-head">'
					+ '<div><h3 class="hero-group-title">' + escapeHtml(title) + '</h3><p class="hero-group-caption">' + escapeHtml(caption) + '</p></div>'
					+ '<span class="hero-group-chip">' + escapeHtml(chipLabel) + '</span>'
					+ '</div>'
					+ '<div class="hero-group-grid ' + escapeHtml(gridClass) + '">'
					+ cards.map(function(card) {
						return renderHeroStatCard(card);
					}).join('')
					+ '</div>'
					+ '</section>';
			}

			function renderHeroStatCard(card) {
				const periodClass = card.scopeType === 'year' ? 'year' : 'period';
				const periodLabel = card.scopeType === 'year' ? 'CelĂ˝ rok' : 'Mesiac';
				const hasDetailItems = Array.isArray(card.detailItems) && card.detailItems.length;
				const hasStoreBreakdownItems = Array.isArray(card.storeBreakdownItems) && card.storeBreakdownItems.length;

				function renderHeroBreakdownItems(items) {
					return items.map(function(item) {
						var hasChildren = Array.isArray(item.children) && item.children.length;
						if (hasChildren) {
							return '<div class="hero-breakdown-row hero-breakdown-row--group"><div class="hero-breakdown-group">'
								+ '<div class="hero-breakdown-row-head"><span class="hero-breakdown-store">' + escapeHtml(item.label) + '</span><span class="hero-breakdown-value">' + formatMetric(item.value, item.format || card.format) + '</span></div>'
								+ '<div class="hero-breakdown-list hero-breakdown-list--nested">' + renderHeroBreakdownItems(item.children) + '</div>'
								+ '</div></div>';
						}
						return '<div class="hero-breakdown-row"><span class="hero-breakdown-store">' + escapeHtml(item.label) + '</span><span class="hero-breakdown-value">' + formatMetric(item.value, item.format || card.format) + '</span></div>';
					}).join('');
				}

				return '<div class="mini-stat' + (card.cardClass ? ' ' + escapeHtml(card.cardClass) : '') + '">'
					+ '<span class="label">' + escapeHtml(card.metric) + '</span>'
					+ '<span class="value">' + formatHeroCardValue(card) + '</span>'
					+ (card.showVariance === false
						? ''
						: '<span class="delta ' + getDeltaClass(card.variance) + '">'
							+ formatPercent(card.variancePct) + ' vs roÄŤnĂ˝ plĂˇn'
							+ '</span>')
					+ (hasDetailItems
						? '<div class="mini-stat-detail-list">' + card.detailItems.map(function(item) {
							return '<span class="mini-stat-detail-line">' + escapeHtml(item.label) + ' ' + formatMetric(item.value, item.format || card.format) + '</span>';
						}).join('') + '</div>'
						: '<span class="tiny">' + escapeHtml(card.detailLabel) + ' ' + formatMetric(card.detailLeft, card.detailLeftFormat || card.format) + ' â€˘ ' + escapeHtml(card.detailRightLabel) + ' ' + formatMetric(card.detailRight, card.detailRightFormat || card.format) + '</span>')
					+ (hasStoreBreakdownItems
						? '<details class="hero-breakdown-panel"><summary class="hero-breakdown-toggle">RozbaliĹĄ po filiĂˇlkach (' + Number(card.storeBreakdownItems.length || 0) + ')</summary><div class="hero-breakdown-list">' + renderHeroBreakdownItems(card.storeBreakdownItems) + '</div></details>'
						: '')
					+ (card.flag ? '<span class="mini-stat-flag">' + escapeHtml(card.flag) + '</span>' : '')
					+ '</div>';
			}

			function buildSnapshotFromSection(section, payload, periodContext) {
				if (!section) {
					return buildEmptyMetricSnapshot('');
				}

				if (periodContext && periodContext.kind === 'filter') {
					return buildStandardMetricSnapshot(section, {
						indexes: periodContext.indexes,
						months: payload.months || [],
					});
				}

				return buildStandardMetricSnapshot(section, {
					month: periodContext && periodContext.month ? periodContext.month : '__YEAR__',
					months: payload.months || [],
				});
			}

			function buildCleanPerformanceSnapshotFromSections(turnoverSection, hoursSection, payload, periodContext) {
				if (!turnoverSection || !hoursSection) {
					return buildEmptyMetricSnapshot('ÄŚistĂ˝ vĂ˝kon');
				}

				const turnover = buildSnapshotFromSection(turnoverSection, payload, periodContext);
				const hours = buildSnapshotFromSection(hoursSection, payload, periodContext);
				const plan = hours.plan ? turnover.plan / hours.plan : 0;
				const real = hours.real ? turnover.real / hours.real : 0;
				const forecast = hours.forecast ? turnover.forecast / hours.forecast : 0;
				const delta = (turnover.hasReal && hours.hasReal) ? (forecast - real) : (forecast - plan);

				return {
					metric: 'ÄŚistĂ˝ vĂ˝kon',
					format: 'number',
					plan: normalizeStoredMetricValue(plan, 'number'),
					real: normalizeStoredMetricValue(real, 'number'),
					forecast: normalizeStoredMetricValue(forecast, 'number'),
					delta: normalizeStoredMetricValue(delta, 'number'),
					variance: normalizeStoredMetricValue(delta, 'number'),
					variancePct: plan ? delta / plan : 0,
					hasReal: turnover.hasReal || hours.hasReal,
					isRealFallback: hours.isRealFallback,
				};
			}

			function buildRequiredNetHoursSnapshotFromResolved(turnover, hours, performance, isYearScope) {
				const currentHoursBase = hours.forecast;
				const requiredHours = performance.plan ? turnover.forecast / performance.plan : 0;
				const deltaHours = normalizeStoredMetricValue(requiredHours - currentHoursBase, 'hours');

				return {
					metric: isYearScope ? 'PotrebnĂ© netto do roÄŤnĂ©ho plĂˇnu ÄŚV' : 'PotrebnĂ© netto do plĂˇnu ÄŚV',
					format: 'hours',
					value: deltaHours,
					valueSigned: true,
					variance: deltaHours,
					variancePct: hours.plan ? deltaHours / hours.plan : 0,
					showVariance: false,
					detailItems: [
						{ label: deltaHours < 0 ? 'UĹˇetriĹĄ hodiny' : 'DoplniĹĄ hodiny', value: requiredHours, format: 'hours' },
						{ label: isYearScope ? 'IST minulosĹĄ + aktuĂˇlna predikcia' : 'AktuĂˇlna predikcia netto', value: currentHoursBase, format: 'hours' },
					],
					flag: isYearScope ? 'MinulosĹĄ + zvyĹˇok roka' : '',
				};
			}

			function buildAggregateRequiredNetHoursSnapshot(payload, periodContext, isYearScope) {
				const turnoverSection = findSectionByMetric(payload, 'Obrat GJ2026');
				const hoursSection = findSectionByMetric(payload, 'Hodiny netto');
				const turnoverBreakdown = turnoverSection && Array.isArray(turnoverSection.breakdown) ? turnoverSection.breakdown : [];
				const hoursBreakdown = hoursSection && Array.isArray(hoursSection.breakdown) ? hoursSection.breakdown : [];
				const itemIds = {};

				turnoverBreakdown.forEach(function(item) { itemIds[String(item.storeId || '').trim()] = true; });
				hoursBreakdown.forEach(function(item) { itemIds[String(item.storeId || '').trim()] = true; });

				const totals = Object.keys(itemIds).reduce(function(result, itemId) {
					const turnoverItem = turnoverBreakdown.find(function(item) { return String(item.storeId || '').trim() === itemId; }) || null;
					const hoursItem = hoursBreakdown.find(function(item) { return String(item.storeId || '').trim() === itemId; }) || null;
					const turnoverItemSection = turnoverItem ? { metric: 'Obrat GJ2026', format: turnoverSection ? turnoverSection.format : 'currency', rows: turnoverItem.rows } : null;
					const hoursItemSection = hoursItem ? { metric: 'Hodiny netto', format: hoursSection ? hoursSection.format : 'hours', rows: hoursItem.rows } : null;
					const performanceSnapshot = buildCleanPerformanceSnapshotFromSections(turnoverItemSection, hoursItemSection, payload, isYearScope ? null : periodContext);
					const turnoverSnapshot = buildSnapshotFromSection(turnoverItemSection, payload, isYearScope ? null : periodContext);
					const hoursSnapshot = buildSnapshotFromSection(hoursItemSection, payload, isYearScope ? null : periodContext);
					const requiredSnapshot = buildRequiredNetHoursSnapshotFromResolved(turnoverSnapshot, hoursSnapshot, performanceSnapshot, isYearScope);

					result.requiredHours += Number(requiredSnapshot.detailItems[0] && requiredSnapshot.detailItems[0].value || 0);
					result.currentHoursBase += Number(requiredSnapshot.detailItems[1] && requiredSnapshot.detailItems[1].value || 0);
					result.deltaHours += Number(requiredSnapshot.value || 0);
					return result;
				}, { requiredHours: 0, currentHoursBase: 0, deltaHours: 0 });

				return {
					metric: isYearScope ? 'PotrebnĂ© netto do roÄŤnĂ©ho plĂˇnu ÄŚV' : 'PotrebnĂ© netto do plĂˇnu ÄŚV',
					format: 'hours',
					value: normalizeStoredMetricValue(totals.deltaHours, 'hours'),
					valueSigned: true,
					variance: normalizeStoredMetricValue(totals.deltaHours, 'hours'),
					variancePct: 0,
					showVariance: false,
					detailItems: [
						{ label: totals.deltaHours < 0 ? 'UĹˇetriĹĄ hodiny' : 'DoplniĹĄ hodiny', value: normalizeStoredMetricValue(totals.requiredHours, 'hours'), format: 'hours' },
						{ label: isYearScope ? 'IST minulosĹĄ + aktuĂˇlna predikcia' : 'AktuĂˇlna predikcia netto', value: normalizeStoredMetricValue(totals.currentHoursBase, 'hours'), format: 'hours' },
					],
					flag: isYearScope ? 'MinulosĹĄ + zvyĹˇok roka' : '',
				};
			}

			function buildHeroStoreBreakdownItems(payload, periodContext, breakdownKey) {
				if (!payload || !payload.scope || payload.scope.type !== 'AGGREGATE') {
					return [];
				}

				const turnoverSection = findSectionByMetric(payload, 'Obrat GJ2026');
				const hoursSection = findSectionByMetric(payload, 'Hodiny netto');
				const turnoverBreakdown = turnoverSection && Array.isArray(turnoverSection.breakdown) ? turnoverSection.breakdown : [];
				const hoursBreakdown = hoursSection && Array.isArray(hoursSection.breakdown) ? hoursSection.breakdown : [];
				const isYearScope = breakdownKey.indexOf('year-') === 0;

				function buildBreakdownValue(turnoverItem, hoursItem) {
					const turnoverItemSection = turnoverItem ? { metric: 'Obrat GJ2026', format: turnoverSection ? turnoverSection.format : 'currency', rows: turnoverItem.rows } : null;
					const hoursItemSection = hoursItem ? { metric: 'Hodiny netto', format: hoursSection ? hoursSection.format : 'hours', rows: hoursItem.rows } : null;
					const performanceSnapshot = buildCleanPerformanceSnapshotFromSections(turnoverItemSection, hoursItemSection, payload, periodContext);
					const hoursSnapshot = buildSnapshotFromSection(hoursItemSection, payload, periodContext);
					const turnoverSnapshot = buildSnapshotFromSection(turnoverItemSection, payload, periodContext);

					if (breakdownKey === 'period-performance') {
						const useReal = shouldUseRealAsHeroPrimaryValue(periodContext, performanceSnapshot);
						return { value: useReal ? performanceSnapshot.real : performanceSnapshot.forecast, format: 'number' };
					}

					if (breakdownKey === 'year-performance') {
						return { value: performanceSnapshot.forecast, format: 'number' };
					}

					if (breakdownKey === 'period-hours' || breakdownKey === 'year-hours') {
						const useReal = !isYearScope && shouldUseRealAsHeroPrimaryValue(periodContext, hoursSnapshot);
						return { value: useReal ? hoursSnapshot.real : hoursSnapshot.forecast, format: 'hours' };
					}

					const requiredSnapshot = buildRequiredNetHoursSnapshotFromResolved(turnoverSnapshot, hoursSnapshot, performanceSnapshot, isYearScope);
					return { value: requiredSnapshot.value, format: 'hours' };
				}

				function buildBreakdownItems(turnoverItems, hoursItems) {
					const itemIds = {};
					(turnoverItems || []).forEach(function(item) { itemIds[String(item.storeId || '').trim()] = true; });
					(hoursItems || []).forEach(function(item) { itemIds[String(item.storeId || '').trim()] = true; });

					return Object.keys(itemIds).map(function(itemId) {
						const turnoverItem = (turnoverItems || []).find(function(item) { return String(item.storeId || '').trim() === itemId; }) || null;
						const hoursItem = (hoursItems || []).find(function(item) { return String(item.storeId || '').trim() === itemId; }) || null;
						const resolvedLabel = String((turnoverItem && turnoverItem.displayLabel) || (hoursItem && hoursItem.displayLabel) || '').trim()
							|| formatStoreDisplayLabel(itemId, (turnoverItem && turnoverItem.storeName) || (hoursItem && hoursItem.storeName) || '');

						if (!resolvedLabel) {
							return null;
						}

						const valueConfig = buildBreakdownValue(turnoverItem, hoursItem);
						const turnoverChildren = turnoverItem && Array.isArray(turnoverItem.breakdown) ? turnoverItem.breakdown : [];
						const hoursChildren = hoursItem && Array.isArray(hoursItem.breakdown) ? hoursItem.breakdown : [];
						const children = turnoverChildren.length || hoursChildren.length
							? buildBreakdownItems(turnoverChildren, hoursChildren)
							: null;

						return {
							label: resolvedLabel,
							value: valueConfig.value,
							format: valueConfig.format,
							children: children && children.length ? children : undefined,
						};
					}).filter(Boolean);
				}

				return buildBreakdownItems(turnoverBreakdown, hoursBreakdown);
			}

			function getHeroPeriodContext(payload) {
				const activeMonthFilter = getActiveChartMonthFilter();
				const selectedMonth = state.selectedMonth || payload.months[0];

				if (activeMonthFilter === 'all') {
					return {
						kind: 'month',
						month: selectedMonth,
						label: getPeriodLabel(selectedMonth),
					};
				}

				return {
					kind: 'filter',
					filter: activeMonthFilter,
					indexes: getMonthIndexesByFilter(payload.months || [], activeMonthFilter),
					label: CHART_MONTH_FILTERS[activeMonthFilter].label,
				};
			}

			function sumValuesByIndexes(values, indexes) {
				return (indexes || []).reduce(function(total, index) {
					return total + Number((values && values[index]) || 0);
				}, 0);
			}

			function hasFallbackRealDisplayForIndexes(section, row, indexes) {
				return (indexes || []).some(function(index) {
					return isFallbackRealDisplay(section, row, index);
				});
			}

			function buildEmptyMetricSnapshot(metric) {
				return {
					metric: metric,
					format: 'number',
					plan: 0,
					real: 0,
					adjustment: 0,
					forecast: 0,
					delta: 0,
					variance: 0,
					variancePct: 0,
					yearTotal: 0,
					hasReal: false,
					hasAdjustment: false,
					realTypeClass: 'real',
					realTooltip: '',
					isRealFallback: false,
				};
			}

			function buildStandardMetricSnapshot(section, options) {
				const config = options || {};
				const indexes = Array.isArray(config.indexes) ? config.indexes : null;
				const hasIndexes = Boolean(indexes && indexes.length);
				const useYear = !hasIndexes && config.month === '__YEAR__';
				const monthIndex = !hasIndexes && !useYear && Array.isArray(config.months)
					? config.months.indexOf(config.month)
					: -1;
				const planRow = section.rows.find(function(row) { return row.type === 'plan'; }) || { values: [], total: 0 };
				const realRow = section.rows.find(function(row) { return row.type === 'real'; }) || { values: [], total: 0 };
				const forecastRow = section.rows.find(function(row) { return row.type === 'forecast'; }) || { values: [], total: 0 };
				const hasAdjustmentRow = Boolean(section.rows.find(function(row) { return row.type === 'adjustment'; }));
				const hasRealRow = Boolean(section.rows.find(function(row) { return row.type === 'real'; }));
				const deltaValues = getMetricDeltaValues(section, planRow, realRow, forecastRow);
				const planValue = hasIndexes
					? sumValuesByIndexes(planRow.values, indexes)
					: (useYear ? Number(planRow.total || 0) : Number(planRow.values[monthIndex] || 0));
				const forecastValue = hasIndexes
					? sumValuesByIndexes(forecastRow.values, indexes)
					: (useYear ? Number(forecastRow.total || 0) : Number(forecastRow.values[monthIndex] || 0));
				const displayedRealValue = hasIndexes
					? indexes.reduce(function(sum, index) {
						return sum + getDisplayedRealValue(section, realRow, index);
					}, 0)
					: (useYear
						? sumArray((realRow.values || []).map(function(value, index) {
							return getDisplayedRealValue(section, realRow, index);
						}))
						: getDisplayedRealValue(section, realRow, monthIndex));
				const deltaValue = hasIndexes
					? sumValuesByIndexes(deltaValues, indexes)
					: (useYear ? normalizeStoredMetricValue(sumArray(deltaValues), section.format) : Number(deltaValues[monthIndex] || 0));
				const hasRealFallback = hasIndexes
					? hasFallbackRealDisplayForIndexes(section, realRow, indexes)
					: (useYear ? hasFallbackRealDisplay(section, realRow) : isFallbackRealDisplay(section, realRow, monthIndex));

				return {
					metric: section.metric,
					format: section.format,
					plan: planValue,
					real: displayedRealValue,
					adjustment: forecastValue,
					forecast: forecastValue,
					delta: deltaValue,
					variance: deltaValue,
					variancePct: planValue ? deltaValue / planValue : 0,
					yearTotal: forecastValue,
					hasReal: hasRealRow,
					hasAdjustment: hasAdjustmentRow || Math.abs(forecastValue) > 0,
					realTypeClass: hasRealFallback ? 'real ist-plan-fill-pill' : 'real',
					realTooltip: hasRealFallback
						? (useYear ? 'IST sumĂˇr obsahuje mesiace doplnenĂ© z plĂˇnu' : 'IST v tomto mesiaci je zatiaÄľ doplnenĂ© z plĂˇnu')
						: '',
					isRealFallback: hasRealFallback,
				};
			}

			function buildDashboardMetricSnapshot(payload, metric, options) {
				const config = options || {};
				const indexes = Array.isArray(config.indexes) ? config.indexes : null;
				const hasIndexes = Boolean(indexes && indexes.length);
				const activeMonth = config.month || '__YEAR__';
				const months = config.months || payload.months || [];

				if (normalizeMetricName(metric) === normalizeMetricName('ÄŚistĂ˝ vĂ˝kon')) {
					const turnover = buildDashboardMetricSnapshot(payload, 'Obrat GJ2026', config);
					const hours = buildDashboardMetricSnapshot(payload, 'Hodiny netto', config);
					const plan = hours.plan ? turnover.plan / hours.plan : 0;
					const real = hours.real ? turnover.real / hours.real : 0;
					const forecast = hours.forecast ? turnover.forecast / hours.forecast : 0;
					const delta = (turnover.hasReal && hours.hasReal) ? (forecast - real) : (forecast - plan);

					return {
						metric: 'ÄŚistĂ˝ vĂ˝kon',
						format: 'number',
						plan: normalizeStoredMetricValue(plan, 'number'),
						real: normalizeStoredMetricValue(real, 'number'),
						adjustment: normalizeStoredMetricValue(forecast, 'number'),
						forecast: normalizeStoredMetricValue(forecast, 'number'),
						delta: normalizeStoredMetricValue(delta, 'number'),
						variance: normalizeStoredMetricValue(delta, 'number'),
						variancePct: plan ? delta / plan : 0,
						yearTotal: normalizeStoredMetricValue(forecast, 'number'),
						hasReal: turnover.hasReal || hours.hasReal,
						hasAdjustment: Math.abs(forecast) > 0,
						realTypeClass: hours.isRealFallback ? 'real ist-plan-fill-pill' : 'real',
						realTooltip: hours.isRealFallback
							? (hasIndexes
								? 'IST v obdobĂ­ obsahuje mesiace doplnenĂ© z plĂˇnu'
								: (activeMonth === '__YEAR__' ? 'IST sumĂˇr obsahuje mesiace doplnenĂ© z plĂˇnu' : 'IST v tomto mesiaci je zatiaÄľ doplnenĂ© z plĂˇnu'))
							: '',
						isRealFallback: hours.isRealFallback,
					};
				}

				const section = findSectionByMetric(payload, metric);
				if (!section) {
					return hasIndexes
						? buildDashboardMetricSnapshot(payload, metric, { month: '__YEAR__', months: months })
						: buildEmptyMetricSnapshot(metric);
				}

				return buildStandardMetricSnapshot(section, {
					month: activeMonth,
					months: months,
					indexes: indexes,
				});
			}

			function getMetricSnapshotForIndexes(payload, metric, indexes) {
				return buildDashboardMetricSnapshot(payload, metric, {
					indexes: indexes,
					months: payload.months || [],
				});
			}

			function resolveHeroSnapshot(payload, metric, periodContext) {
				if (periodContext && periodContext.kind === 'filter') {
					return getMetricSnapshotForIndexes(payload, metric, periodContext.indexes);
				}

				return getMetricSnapshot(payload, metric, periodContext && periodContext.month ? periodContext.month : '__YEAR__');
			}

			function shouldUseRealAsHeroPrimaryValue(periodContext, snapshot) {
				return Boolean(
					periodContext
					&& periodContext.kind === 'month'
					&& periodContext.month
					&& periodContext.month !== '__YEAR__'
					&& snapshot
					&& snapshot.hasReal
					&& !snapshot.isRealFallback
				);
			}

			function buildHeroWidgets(payload, periodContext) {
				const hours = resolveHeroSnapshot(payload, 'Hodiny netto', periodContext);
				const performance = resolveHeroSnapshot(payload, 'ÄŚistĂ˝ vĂ˝kon', periodContext);
				const yearHours = getMetricSnapshot(payload, 'Hodiny netto', '__YEAR__');
				const yearPerformance = getYearCleanPerformanceSnapshot(payload);
				const requiredPeriodHours = buildRequiredNetHoursSnapshot(payload, periodContext);
				const requiredYearHours = buildRequiredNetHoursSnapshot(payload, null, { isYearScope: true });
				const useRealPerformanceAsPrimary = shouldUseRealAsHeroPrimaryValue(periodContext, performance);
				const useRealHoursAsPrimary = shouldUseRealAsHeroPrimaryValue(periodContext, hours);

				return [
					{
						breakdownKey: 'period-performance',
						scopeType: 'period',
						metric: useRealPerformanceAsPrimary ? 'IST ÄŚV' : 'Ăšprava VOD ÄŚV',
						format: performance.format,
						value: useRealPerformanceAsPrimary ? performance.real : performance.forecast,
						variance: (useRealPerformanceAsPrimary ? performance.real : performance.forecast) - performance.plan,
						variancePct: performance.plan ? ((useRealPerformanceAsPrimary ? performance.real : performance.forecast) - performance.plan) / performance.plan : 0,
						showVariance: false,
						detailItems: useRealPerformanceAsPrimary
							? [
								{ label: getDisplayPlanLabel(), value: performance.plan, format: performance.format },
							]
							: [
								{ label: performance.isRealFallback ? 'IST z roÄŤnĂ©ho plĂˇnu' : 'IST', value: performance.real, format: performance.format },
								{ label: getDisplayPlanLabel(), value: performance.plan, format: performance.format },
							],
					},
					Object.assign({
						breakdownKey: 'period-required-hours',
						scopeType: 'period',
					}, requiredPeriodHours),
					{
						breakdownKey: 'period-hours',
						scopeType: 'period',
						metric: useRealHoursAsPrimary ? 'IST netto' : 'Ăšprava VOD netto',
						format: hours.format,
						value: useRealHoursAsPrimary ? hours.real : hours.forecast,
						variance: (useRealHoursAsPrimary ? hours.real : hours.forecast) - hours.plan,
						variancePct: hours.plan ? ((useRealHoursAsPrimary ? hours.real : hours.forecast) - hours.plan) / hours.plan : 0,
						showVariance: false,
						detailItems: useRealHoursAsPrimary
							? [
								{ label: getDisplayPlanLabel(), value: hours.plan, format: hours.format },
							]
							: [
								{ label: hours.isRealFallback ? 'IST z roÄŤnĂ©ho plĂˇnu' : 'IST', value: hours.real, format: hours.format },
								{ label: getDisplayPlanLabel(), value: hours.plan, format: hours.format },
							],
						cardClass: hours.isRealFallback ? 'is-ist-fallback' : '',
						flag: hours.isRealFallback ? 'IST doplnenĂ© z plĂˇnu' : '',
					},
					{
						breakdownKey: 'year-performance',
						scopeType: 'year',
						metric: 'Ăšprava VOD ÄŚV rok',
						format: yearPerformance.format,
						value: yearPerformance.forecast,
						variance: yearPerformance.forecast - yearPerformance.plan,
						variancePct: yearPerformance.plan ? (yearPerformance.forecast - yearPerformance.plan) / yearPerformance.plan : 0,
						showVariance: false,
						detailItems: [
							{ label: 'IST', value: yearPerformance.real, format: yearPerformance.format },
							{ label: getDisplayPlanLabel(), value: yearPerformance.plan, format: yearPerformance.format },
						],
					},
					Object.assign({
						breakdownKey: 'year-required-hours',
						scopeType: 'year',
					}, requiredYearHours),
					{
						breakdownKey: 'year-hours',
						scopeType: 'year',
						metric: 'Ăšprava VOD netto rok',
						format: yearHours.format,
						value: yearHours.forecast,
						variance: yearHours.forecast - yearHours.plan,
						variancePct: yearHours.plan ? (yearHours.forecast - yearHours.plan) / yearHours.plan : 0,
						showVariance: false,
						detailItems: [
							{ label: 'IST', value: yearHours.real, format: yearHours.format },
							{ label: getDisplayPlanLabel(), value: yearHours.plan, format: yearHours.format },
						],
						cardClass: yearHours.isRealFallback ? 'is-ist-fallback' : '',
						flag: yearHours.isRealFallback ? 'IST doplnenĂ© z plĂˇnu' : '',
					},
				].map(function(card) {
					card.storeBreakdownItems = buildHeroStoreBreakdownItems(payload, card.scopeType === 'year' ? null : periodContext, card.breakdownKey);
					return card;
				});
			}

			function getYearToDateAverageSnapshot(payload, metric) {
				const section = payload.table.find(function(item) {
					return normalizeMetricName(item.metric) === normalizeMetricName(metric);
				});

				if (!section) {
					return {
						metric: metric,
						format: 'number',
						plan: 0,
						real: 0,
						forecast: 0,
						monthsCount: 0,
					};
				}

				const planRow = section.rows.find(function(row) { return row.type === 'plan'; }) || { values: [] };
				const realRow = section.rows.find(function(row) { return row.type === 'real'; }) || { values: [] };
				const forecastRow = section.rows.find(function(row) { return row.type === 'forecast'; }) || { values: [] };
				const activeIndexes = realRow.values.reduce(function(result, value, index) {
					if (Number(value || 0) > 0) {
						result.push(index);
					}
					return result;
				}, []);

				return {
					metric: section.metric,
					format: section.format,
					plan: averageValuesByIndexes(planRow.values, activeIndexes),
					real: averageValuesByIndexes(realRow.values, activeIndexes),
					forecast: averageValuesByIndexes(forecastRow.values, activeIndexes),
					monthsCount: activeIndexes.length,
				};
			}

			function getYearCleanPerformanceSnapshot(payload) {
				const turnover = getMetricSnapshot(payload, 'Obrat GJ2026', '__YEAR__');
				const hours = getMetricSnapshot(payload, 'Hodiny netto', '__YEAR__');

				const plan = hours.plan ? turnover.plan / hours.plan : 0;
				const real = hours.real ? turnover.real / hours.real : 0;
				const forecast = hours.forecast ? turnover.forecast / hours.forecast : 0;

				return {
					format: 'number',
					plan: plan,
					real: real,
					forecast: forecast,
					forecastTurnover: turnover.forecast,
					forecastHours: hours.forecast,
				};
			}

			function buildRequiredNetHoursSnapshot(payload, periodContext, options) {
				const config = options || {};
				const isYearScope = Boolean(config.isYearScope);
				if (payload && payload.scope && payload.scope.type === 'AGGREGATE') {
					return buildAggregateRequiredNetHoursSnapshot(payload, periodContext, isYearScope);
				}
				const turnoverSection = findSectionByMetric(payload, 'Obrat GJ2026');
				const hoursSection = findSectionByMetric(payload, 'Hodiny netto');
				const turnover = periodContext
					? resolveHeroSnapshot(payload, 'Obrat GJ2026', periodContext)
					: getMetricSnapshot(payload, 'Obrat GJ2026', '__YEAR__');
				const hours = periodContext
					? resolveHeroSnapshot(payload, 'Hodiny netto', periodContext)
					: getMetricSnapshot(payload, 'Hodiny netto', '__YEAR__');
				const performance = buildCleanPerformanceSnapshotFromSections(turnoverSection, hoursSection, payload, periodContext)
					|| (periodContext
						? resolveHeroSnapshot(payload, 'ÄŚistĂ˝ vĂ˝kon', periodContext)
						: getMetricSnapshot(payload, 'ÄŚistĂ˝ vĂ˝kon', '__YEAR__'));

				return buildRequiredNetHoursSnapshotFromResolved(turnover, hours, performance, isYearScope);
			}

			function updateChartPanelState() {
				const panel = document.getElementById('mainChartPanel');
				const button = document.getElementById('chartCollapseButton');
				const collapsed = Boolean(state.selectedChartCollapsed);
				panel.classList.toggle('is-collapsed', collapsed);
				button.textContent = collapsed ? 'RozbaliĹĄ graf' : 'ZbaliĹĄ graf';
				button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
			}

			function averageValuesByIndexes(values, indexes) {
				if (!indexes.length) {
					return 0;
				}

				const total = indexes.reduce(function(sum, index) {
					return sum + Number((values && values[index]) || 0);
				}, 0);
				return total / indexes.length;
			}

			function buildChartsFromPayload(payload) {
				const months = payload.months || [];
				const turnoverSection = findSectionByMetric(payload, 'Obrat GJ2026');
				const netSection = findSectionByMetric(payload, 'Hodiny netto');
				const performanceSection = findSectionByMetric(payload, 'ÄŚistĂ˝ vĂ˝kon');
				const workforceSection = findSectionByMetric(payload, 'Ĺ truktĂşra filiĂˇlky (plnĂ© ĂşvĂ¤zky)');
				const getRowValues = function(section, type) {
					const row = section && section.rows ? section.rows.find(function(item) { return item.type === type; }) : null;
					return row && row.values ? row.values : months.map(function() { return 0; });
				};
				const workforceHoursRow = workforceSection && workforceSection.rows
					? workforceSection.rows.find(function(item) { return item.type === 'structure-hours-derived'; })
					: null;
				const workforceHoursPlanRow = workforceSection && workforceSection.rows
					? workforceSection.rows.find(function(item) { return item.type === 'structure-hours-plan'; })
					: null;
				const workforceHoursRealRow = workforceSection && workforceSection.rows
					? workforceSection.rows.find(function(item) { return item.type === 'structure-hours-real'; })
					: null;

				return {
					obrat: {
						labels: months,
						plan: getRowValues(turnoverSection, 'plan'),
						forecast: getRowValues(turnoverSection, 'forecast'),
						real: getRowValues(turnoverSection, 'real'),
					},
					hours: {
						labels: months,
						plan: getRowValues(netSection, 'plan'),
						forecast: getRowValues(netSection, 'forecast'),
						real: getRowValues(netSection, 'real'),
					},
					performance: {
						labels: months,
						plan: getRowValues(performanceSection, 'plan'),
						forecast: getRowValues(performanceSection, 'forecast'),
						real: getRowValues(performanceSection, 'real'),
					},
					workforce: {
						labels: months,
						plan: workforceHoursPlanRow && workforceHoursPlanRow.values ? workforceHoursPlanRow.values : months.map(function() { return 0; }),
						forecast: workforceHoursRow && workforceHoursRow.values ? workforceHoursRow.values : months.map(function() { return 0; }),
						real: workforceHoursRealRow && workforceHoursRealRow.values ? workforceHoursRealRow.values.map(function(value) { return value == null ? 0 : value; }) : months.map(function() { return 0; }),
						realFlags: workforceHoursRealRow && workforceHoursRealRow.hasRealFlags ? workforceHoursRealRow.hasRealFlags : months.map(function() { return false; }),
					},
				};
			}

			function getActiveChartMode() {
				return Object.prototype.hasOwnProperty.call(CHART_MODES, state.selectedChartMode)
					? state.selectedChartMode
					: 'obrat';
			}

			function getActiveChartMonthFilter() {
				return Object.prototype.hasOwnProperty.call(CHART_MONTH_FILTERS, state.selectedChartMonthFilter)
					? state.selectedChartMonthFilter
					: 'all';
			}

			function renderChartModeControls(activeMode) {
				document.getElementById('chartModeControls').innerHTML = Object.keys(CHART_MODES).map(function(modeKey) {
					const mode = CHART_MODES[modeKey];
					const activeClass = modeKey === activeMode ? 'chart-mode-button is-active' : 'chart-mode-button';
					return '<button class="' + activeClass + '" type="button" data-chart-mode="' + escapeHtml(modeKey) + '">' + escapeHtml(mode.label) + '</button>';
				}).join('');
			}

			function renderChartMonthFilterControls(activeFilter) {
				document.getElementById('chartMonthFilterControls').innerHTML = Object.keys(CHART_MONTH_FILTERS).map(function(filterKey) {
					const filter = CHART_MONTH_FILTERS[filterKey];
					const activeClass = filterKey === activeFilter ? 'chart-mode-button chart-mode-button--subtle is-active' : 'chart-mode-button chart-mode-button--subtle';
					return '<button class="' + activeClass + '" type="button" data-chart-month-filter="' + escapeHtml(filterKey) + '">' + escapeHtml(filter.label) + '</button>';
				}).join('');
			}

			function buildLargeChartConfig(activeMode, chartMonthFilter, charts) {
				if (activeMode === 'hours') {
					const filteredHours = filterChartSeriesByMonth(charts.hours.labels, {
						plan: charts.hours.plan,
						forecast: charts.hours.forecast,
						real: charts.hours.real,
					}, chartMonthFilter);
					return buildUnifiedMetricChart({
						labels: filteredHours.labels.map(formatMonthShort),
						format: 'hours',
						plan: filteredHours.plan,
						forecast: filteredHours.forecast,
						real: filteredHours.real,
						forecastLabel: 'Ăšprava VOD Hodiny netto',
					});
				}

				if (activeMode === 'workforce') {
					const filteredWorkforce = filterChartSeriesByMonth(charts.workforce.labels, {
						plan: charts.workforce.plan,
						forecast: charts.workforce.forecast,
						real: charts.workforce.real,
						realFlags: charts.workforce.realFlags,
					}, chartMonthFilter);
					return buildUnifiedMetricChart({
						labels: filteredWorkforce.labels.map(formatMonthShort),
						format: 'hours',
						plan: filteredWorkforce.plan,
						forecast: filteredWorkforce.forecast,
						real: filteredWorkforce.real,
						realMuted: !filteredWorkforce.realFlags.some(function(flag) { return Boolean(flag); }),
						forecastLabel: 'AktuĂˇlna ĹˇtruktĂşra hodĂ­n',
					});
				}

				if (activeMode === 'performance') {
					const filteredPerformance = filterChartSeriesByMonth(charts.performance.labels, {
						plan: charts.performance.plan,
						forecast: charts.performance.forecast,
						real: charts.performance.real,
					}, chartMonthFilter);
					return buildUnifiedMetricChart({
						labels: filteredPerformance.labels.map(formatMonthShort),
						format: 'number',
						plan: filteredPerformance.plan,
						forecast: filteredPerformance.forecast,
						real: filteredPerformance.real,
						forecastLabel: 'Ăšprava VOD ÄŚistĂ˝ vĂ˝kon',
					});
				}

				const filteredTurnover = filterChartSeriesByMonth(charts.obrat.labels, {
					plan: charts.obrat.plan,
					forecast: charts.obrat.forecast,
					real: charts.obrat.real,
				}, chartMonthFilter);
				return buildUnifiedMetricChart({
					labels: filteredTurnover.labels.map(formatMonthShort),
					format: 'currency',
					plan: filteredTurnover.plan,
					forecast: filteredTurnover.forecast,
					real: filteredTurnover.real,
				});
			}

			function renderCharts(payload) {
				updateChartPanelState();
				if (state.selectedChartCollapsed) {
					return;
				}
				const charts = buildChartsFromPayload(payload);
				const activeMode = getActiveChartMode();
				const activeMonthFilter = getActiveChartMonthFilter();
				const activeChartMeta = CHART_MODES[activeMode];
				document.getElementById('chartModeTitle').textContent = activeChartMeta.title;
				document.getElementById('chartModeSubtitle').textContent = activeChartMeta.subtitle + ' ' + CHART_MONTH_FILTERS[activeMonthFilter].suffix;
				renderChartModeControls(activeMode);
				renderChartMonthFilterControls(activeMonthFilter);
				renderOrUpdateChart('unifiedChart', buildLargeChartConfig(activeMode, activeMonthFilter, charts));
			}

			function buildUnifiedMetricChart(config) {
				return {
					type: 'line',
					data: {
						labels: config.labels,
						datasets: buildUnifiedMetricDatasets(config)
					},
					options: chartOptions(config.format, {
						labelMode: 'badge-all',
						chartPaddingTop: 84,
					})
				};
			}

			function createOverlayDataset(config) {
				return {
					type: 'line',
					label: config.label,
					data: config.data,
					borderColor: config.borderColor,
					backgroundColor: config.backgroundColor,
					labelColor: config.labelColor || config.borderColor,
					valueFormat: config.valueFormat,
					fill: true,
					tension: config.tension != null ? config.tension : 0.28,
					borderWidth: config.borderWidth != null ? config.borderWidth : 3,
					pointRadius: config.pointRadius != null ? config.pointRadius : 3,
					pointHoverRadius: config.pointHoverRadius != null ? config.pointHoverRadius : 5,
					pointBackgroundColor: '#ffffff',
					pointBorderColor: config.pointBorderColor || config.borderColor,
					pointBorderWidth: config.pointBorderWidth != null ? config.pointBorderWidth : 2,
					borderDash: config.borderDash,
					order: config.order != null ? config.order : 0,
				};
			}

			function buildUnifiedMetricDatasets(config) {
				const datasets = [
					createOverlayDataset({
						label: getDisplayPlanLabel(),
						data: config.plan,
						borderColor: getThemeColor('--chart-plan', '#2563eb'),
						backgroundColor: getThemeColor('--chart-plan-soft', 'rgba(37, 99, 235, 0.18)'),
						valueFormat: config.format,
						order: 1,
					}),
					createOverlayDataset({
						label: config.forecastLabel || getDisplayForecastLabel(),
						data: config.forecast,
						borderColor: getThemeColor('--chart-forecast', '#c0352b'),
						backgroundColor: getThemeColor('--chart-forecast-soft', 'rgba(192, 53, 43, 0.18)'),
						labelColor: getThemeColor('--chart-forecast', '#c0352b'),
						valueFormat: config.format,
						order: 2,
					}),
				];

				datasets.push(createOverlayDataset({
					label: 'IST',
					data: config.real,
					borderColor: config.realMuted ? getThemeColor('--muted', '#64748b') : getThemeColor('--chart-ist', '#111827'),
					backgroundColor: config.realMuted ? 'rgba(100, 116, 139, 0.10)' : getThemeColor('--chart-ist-soft', 'rgba(17, 24, 39, 0.12)'),
					labelColor: config.realMuted ? getThemeColor('--muted', '#64748b') : getThemeColor('--chart-ist', '#111827'),
					valueFormat: config.format,
					borderDash: config.realMuted ? [6, 4] : undefined,
					pointBackgroundColor: config.realMuted ? '#f8fafc' : '#ffffff',
					pointBorderColor: config.realMuted ? getThemeColor('--muted', '#64748b') : getThemeColor('--chart-ist', '#111827'),
					order: 4,
				}));

				return datasets;
			}

			function getViewportWidth() {
				return window.innerWidth || document.documentElement.clientWidth || 1440;
			}

			function getFocusedMonthForCompactTables(months) {
				if (!Array.isArray(months) || !months.length) {
					return '';
				}

				if (state.selectedMonth && state.selectedMonth !== '__YEAR__' && months.indexOf(state.selectedMonth) > -1) {
					return state.selectedMonth;
				}

				return getSuggestedMonth(months) || months[0];
			}

			function getActiveTableView() {
				return Object.prototype.hasOwnProperty.call(TABLE_VIEWS, state.selectedTableView)
					? state.selectedTableView
					: 'monthly';
			}

			function normalizeSelectedMonthForCurrentView(payload) {
				const months = payload && Array.isArray(payload.months) ? payload.months : [];
				const hasSelectedMonth = months.indexOf(state.selectedMonth) > -1;

				if (getActiveTableView() === 'weekly') {
					if (!hasSelectedMonth) {
						state.selectedMonth = getSuggestedMonth(months);
					}
					return;
				}

				if (!state.selectedMonth || (!hasSelectedMonth && state.selectedMonth !== '__YEAR__')) {
					state.selectedMonth = getSuggestedMonth(months);
				}
			}

			function renderTableViewControls(activeView) {
				document.getElementById('tableViewControls').innerHTML = Object.keys(TABLE_VIEWS).map(function(viewKey) {
					const view = TABLE_VIEWS[viewKey];
					const activeClass = viewKey === activeView ? 'chart-mode-button chart-mode-button--subtle is-active' : 'chart-mode-button chart-mode-button--subtle';
					return renderIconToggleButton(activeClass, 'data-table-view', viewKey, view.label, view.meta || '', view.icon || 'table', view.description || view.label, viewKey === activeView);
				}).join('');
			}

			function getRowLayerControlsForView(activeView) {
				return ROW_LAYER_CONTROLS.filter(function(control) {
					return activeView !== 'weekly' || control.key !== 'special';
				});
			}

			function isRowLayerVisible(layerKey) {
				return state.rowLayerVisibility[layerKey] !== false;
			}

			function renderRowVisibilityControls(activeView) {
				const container = document.getElementById('rowVisibilityControls');
				const controls = getRowLayerControlsForView(activeView);
				container.classList.toggle('hidden', !controls.length);
				container.innerHTML = controls.map(function(control) {
					const activeClass = isRowLayerVisible(control.key)
						? 'chart-mode-button chart-mode-button--subtle is-active'
						: 'chart-mode-button chart-mode-button--subtle';
					return renderIconToggleButton(activeClass, 'data-row-layer', control.key, control.label, control.meta || '', control.icon || 'layers', control.title || control.label, isRowLayerVisible(control.key));
				}).join('');
			}

			function toggleRowLayerVisibility(layerKey) {
				if (!Object.prototype.hasOwnProperty.call(state.rowLayerVisibility, layerKey)) {
					return;
				}

				state.rowLayerVisibility[layerKey] = !isRowLayerVisible(layerKey);
				const payload = getActiveDashboard();
				if (payload) {
					renderMetricTable(payload);
				}
			}

			function getRowLayerForRowType(rowType) {
				switch (String(rowType || '')) {
					case 'plan':
					case 'static-plan':
					case 'structure-hours-plan':
					case 'structure-days':
						return 'plan';
					case 'real':
					case 'structure-hours-real':
						return 'real';
					case 'forecast':
					case 'workforce-total':
					case 'structure-hours-derived':
						return 'forecast';
					case 'delta':
						return 'delta';
					case 'recommendation':
					case 'recommendation-result':
					case 'vacation-guide':
						return 'recommendation';
					default:
						return 'special';
				}
			}

			function filterVisibleDisplayRows(rows) {
				return (rows || []).filter(function(row) {
					if (getActiveTableView() === 'monthly' && (row && row.type === 'recommendation' || row && row.type === 'recommendation-result')) {
						return false;
					}
					return isRowLayerVisible(getRowLayerForRowType(row && row.type));
				});
			}

			function setMetricCollapseControlsVisibility(visible) {
				const collapseButton = document.getElementById('collapseAllMetricsButton');
				const expandButton = document.getElementById('expandAllMetricsButton');
				collapseButton.classList.toggle('hidden', !visible);
				expandButton.classList.toggle('hidden', !visible);
			}

			function getWeeklyFocusMonth(payload) {
				const months = payload && Array.isArray(payload.months) ? payload.months : [];
				if (months.indexOf(state.selectedMonth) > -1) {
					return state.selectedMonth;
				}

				return getSuggestedMonth(months) || months[0] || '';
			}

			function buildMonthWeekBuckets(monthLabel) {
				const monthDate = parseChartMonthLabel(monthLabel);
				if (!monthDate) {
					return [];
				}

				const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
				const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
				const calendarYearStart = getCalendarYearStartForDate(monthStart);
				const buckets = [];
				let bucketStart = new Date(monthStart);
				let bucketIndex = 1;

				while (bucketStart.getTime() <= monthEnd.getTime()) {
					const dayOfWeek = bucketStart.getDay();
					const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
					const rawBucketEnd = new Date(bucketStart.getFullYear(), bucketStart.getMonth(), bucketStart.getDate() + daysUntilSunday);
					const bucketEnd = rawBucketEnd.getTime() > monthEnd.getTime() ? new Date(monthEnd) : rawBucketEnd;
					const dayCount = Math.round((bucketEnd.getTime() - bucketStart.getTime()) / 86400000) + 1;
					const weekNumber = getCalendarYearWeekNumber(bucketEnd, calendarYearStart);

					buckets.push({
						key: 'week-' + bucketIndex,
						label: 'KW' + weekNumber,
						rangeLabel: formatWeekBucketRange(bucketStart, bucketEnd),
						startDate: new Date(bucketStart),
						endDate: new Date(bucketEnd),
						dayCount: dayCount,
					});

					bucketStart = new Date(bucketEnd.getFullYear(), bucketEnd.getMonth(), bucketEnd.getDate() + 1);
					bucketIndex += 1;
				}

				return buckets;
			}

			function getCalendarYearStartForDate(dateValue) {
				return new Date(dateValue.getFullYear(), 0, 1);
			}

			function getCalendarYearWeekNumber(dateValue, calendarYearStart) {
				const diffDays = Math.floor((dateValue.getTime() - calendarYearStart.getTime()) / 86400000);
				return Math.max(1, Math.min(52, Math.floor(diffDays / 7) + 1));
			}

			function formatWeekBucketRange(startDate, endDate) {
				const startMonth = startDate.getMonth() + 1;
				const endMonth = endDate.getMonth() + 1;
				if (startMonth === endMonth) {
					return startDate.getDate() + '.-' + endDate.getDate() + '.' + startMonth + '.';
				}

				return startDate.getDate() + '.' + startMonth + '.-' + endDate.getDate() + '.' + endMonth + '.';
			}

			function getCollapsedWeeklyMetricLabel(metric) {
				const rawMetric = getMetricDisplayLabel(metric);
				const normalizedMetric = normalizeMetricName(rawMetric);
				const replacements = [
					{ match: 'pn kratkodobe', label: 'PN krĂˇtkodobĂ©' },
					{ match: 'dlhodoba nepritomnost (33+ dni) (b)', label: 'DlhodobĂˇ neprĂ­t.' },
					{ match: 'externa pracovna agentura (+) reinigung', label: 'AgentĂşra Reinigung' },
					{ match: 'externa pracovna agentura (+) wareneinraumung', label: 'AgentĂşra Waren' },
					{ match: 'odmena za pr.pracu ziak (+) 50%', label: 'Ĺ˝iak 50%' },
					{ match: 'odmena za dohodu', label: 'Odmena za dohodu' },
					{ match: 'odmena za dohodu (-)', label: 'Odmena za dohodu' },
					{ match: 'odmena za dohodu (+)', label: 'Odmena za dohodu' },
					{ match: 'dovolenka (-)', label: 'Dovolenka' },
					{ match: 'hodiny brutto gj2026', label: 'Hodiny brutto' },
					{ match: 'hodiny netto', label: 'Hodiny netto' },
					{ match: 'cisty vykon', label: 'ÄŚistĂ˝ vĂ˝kon' },
				];

				const mapped = replacements.find(function(entry) {
					return normalizedMetric === entry.match;
				});
				if (mapped) {
					return mapped.label;
				}

				const strippedMetric = rawMetric
					.replace(/\s*\([^)]*\)/g, '')
					.replace(/\s*[+\-]+\s*$/g, '')
					.replace(/\s+/g, ' ')
					.trim();
				if (strippedMetric.length <= 24) {
					return strippedMetric || rawMetric;
				}

				return strippedMetric.slice(0, 21).trim() + '...';
			}

			function getWeeklyDistributionMode(snapshot) {
				if (!snapshot) {
					return 'split';
				}

				const normalizedMetric = normalizeMetricName(snapshot.metric || '');
				const usesWeightedAverage = snapshot.format === 'fte'
					|| normalizedMetric === normalizeMetricName('ÄŚistĂ˝ vĂ˝kon')
					|| normalizedMetric.indexOf(normalizeMetricName('Ĺ truktĂşra filiĂˇlky')) === 0;

				return usesWeightedAverage ? 'weighted-average' : 'split';
			}

			function buildWeeklyMetricSeries(snapshot, buckets) {
				const safeBuckets = Array.isArray(buckets) ? buckets : [];
				const weights = safeBuckets.map(function(bucket) { return Math.max(1, Number(bucket.dayCount || 0)); });
				const distributionMode = getWeeklyDistributionMode(snapshot);
				const distribute = function(value) {
					if (!weights.length) {
						return [];
					}

					if (distributionMode === 'weighted-average') {
						const normalizedValue = normalizeStoredMetricValue(value, snapshot.format);
						return weights.map(function() { return normalizedValue; });
					}

					return distributeWeightedValue(value, weights, snapshot.format);
				};

				const planSeries = distribute(snapshot.plan);
				const realSeries = distribute(snapshot.real);
				const forecastSeries = distribute(snapshot.forecast);
				const deltaSeries = distribute(snapshot.delta);

				return safeBuckets.map(function(bucket, index) {
					return {
						key: bucket.key,
						index: index,
						label: bucket.label,
						rangeLabel: bucket.rangeLabel,
						dayCount: Number(bucket.dayCount || 0),
						plan: planSeries[index] || 0,
						real: realSeries[index] || 0,
						forecast: forecastSeries[index] || 0,
						delta: deltaSeries[index] || 0,
					};
				});
			}

			function buildResolvedWeeklyMetricSeries(section, payload, buckets, focusMonth, snapshot) {
				const safeSnapshot = snapshot || getMetricSnapshot(payload, section.metric, focusMonth);
				const persistedWeeklyValues = getPersistedWeeklyOverrideValues(payload, section.metric, focusMonth);
				return applyPendingWeeklyForecastValues(
					section,
					safeSnapshot,
					focusMonth,
					applyExplicitWeeklyForecastValues(safeSnapshot, buildWeeklyMetricSeries(safeSnapshot, buckets), persistedWeeklyValues)
				);
			}

			function hasExplicitWeeklyValuesForMetric(payload, metric, focusMonth) {
				const pendingValues = getPendingWeeklyAdjustmentValues(metric, focusMonth);
				if (Array.isArray(pendingValues) && pendingValues.length) {
					return true;
				}

				const persistedValues = getPersistedWeeklyOverrideValues(payload, metric, focusMonth);
				return Array.isArray(persistedValues) && persistedValues.length > 0;
			}

			function buildWeeklyStructureHoursSeries(payload, buckets, focusMonth) {
				const workforceSection = findSectionByMetric(payload, 'Ĺ truktĂşra filiĂˇlky (plnĂ© ĂşvĂ¤zky)');
				if (!workforceSection || !Array.isArray(workforceSection.rows)) {
					return [];
				}

				const monthIndex = payload && Array.isArray(payload.months) ? payload.months.indexOf(focusMonth) : -1;
				if (monthIndex === -1) {
					return [];
				}

				const planRow = workforceSection.rows.find(function(row) { return row.type === 'structure-hours-plan'; }) || { values: [] };
				const realRow = workforceSection.rows.find(function(row) { return row.type === 'structure-hours-real'; }) || { values: [] };
				const forecastRow = workforceSection.rows.find(function(row) { return row.type === 'structure-hours-derived'; }) || { values: [] };
				const weights = (Array.isArray(buckets) ? buckets : []).map(function(bucket) {
					return Math.max(1, Number(bucket.dayCount || 0));
				});
				const weeklySeries = buildWeeklyMetricSeries({
					format: 'hours',
					plan: Number(planRow.values[monthIndex] || 0),
					real: Number(realRow.values[monthIndex] || 0),
					forecast: Number(forecastRow.values[monthIndex] || 0),
					delta: 0,
				}, buckets);

				if (!weeklySeries.length) {
					return weeklySeries;
				}

				const distribute = function(value) {
					return distributeWeightedValue(value, weights, 'hours');
				};
				const planSeries = distribute(Number(planRow.values[monthIndex] || 0));
				const realSeries = distribute(Number(realRow.values[monthIndex] || 0));
				const forecastSeries = distribute(Number(forecastRow.values[monthIndex] || 0));

				return weeklySeries.map(function(week, index) {
					const planValue = Number(planSeries[index] || 0);
					const realValue = Number(realSeries[index] || 0);
					const forecastValue = Number(forecastSeries[index] || 0);
					return Object.assign({}, week, {
						plan: planValue,
						real: realValue,
						forecast: forecastValue,
						delta: getMetricDeltaValue('hours', planValue, realValue, false, forecastValue),
					});
				});
			}

			function hasActualWeeklyReferenceForSection(section, payload, focusMonth) {
				const monthIndex = payload && Array.isArray(payload.months) ? payload.months.indexOf(focusMonth) : -1;
				const realRow = section && Array.isArray(section.rows)
					? section.rows.find(function(row) { return row.type === 'real'; })
					: null;
				if (monthIndex === -1 || !realRow) {
					return false;
				}

				return hasActualRealValue(realRow, monthIndex);
			}

			function buildWeeklyNetMetricSeries(section, payload, buckets, focusMonth, snapshot, cache) {
				const safeSnapshot = snapshot || getMetricSnapshot(payload, section.metric, focusMonth);
				if (hasExplicitWeeklyValuesForMetric(payload, section.metric, focusMonth)) {
					return buildResolvedWeeklyMetricSeries(section, payload, buckets, focusMonth, safeSnapshot);
				}

				const baseSeries = buildResolvedWeeklyMetricSeries(section, payload, buckets, focusMonth, safeSnapshot);
				if (getPendingAdjustmentValue(section.metric, focusMonth) != null) {
					return baseSeries;
				}

				const structureHoursSeries = buildWeeklyStructureHoursSeries(payload, buckets, focusMonth);
				const componentMetrics = Array.isArray(window.ProDashboardShared.NET_HOURS_COMPONENTS)
					? window.ProDashboardShared.NET_HOURS_COMPONENTS.map(function(item) { return item[0]; })
					: [];
				const hasActualNet = hasActualWeeklyReferenceForSection(section, payload, focusMonth);

				if (!baseSeries.length || !structureHoursSeries.length || !componentMetrics.length) {
					return baseSeries;
				}

				return baseSeries.map(function(week, index) {
					const planValue = Number(week.plan || 0);
					const realValue = Number(week.real || 0);
					const structureWeek = structureHoursSeries[index] || { plan: 0, forecast: 0 };
					const forecastValue = normalizeStoredMetricValue(
						planValue + computeNetHoursDelta(
							Number(structureWeek.forecast || 0) - Number(structureWeek.plan || 0),
							function(metric) {
								const componentSection = findSectionByMetric(payload, metric);
								if (!componentSection) {
									return 0;
								}
								const componentSeries = buildWeeklySeriesForSection(componentSection, payload, buckets, focusMonth, cache);
								const componentWeek = componentSeries[index] || { plan: 0, forecast: 0 };
								return Number(componentWeek.forecast || 0) - Number(componentWeek.plan || 0);
							}
						),
						safeSnapshot.format
					);

					return Object.assign({}, week, {
						forecast: forecastValue,
						delta: getMetricDeltaValue(safeSnapshot.format, planValue, realValue, hasActualNet, forecastValue),
					});
				});
			}

			function buildWeeklyPerformanceMetricSeries(section, payload, buckets, focusMonth, snapshot, cache) {
				const safeSnapshot = snapshot || getMetricSnapshot(payload, section.metric, focusMonth);
				const baseSeries = buildResolvedWeeklyMetricSeries(section, payload, buckets, focusMonth, safeSnapshot);
				const turnoverSection = findSectionByMetric(payload, 'Obrat GJ2026');
				const netSection = findSectionByMetric(payload, 'Hodiny netto');

				if (!baseSeries.length || !turnoverSection || !netSection) {
					return baseSeries;
				}

				const turnoverSeries = buildWeeklySeriesForSection(turnoverSection, payload, buckets, focusMonth, cache);
				const netSeries = buildWeeklySeriesForSection(netSection, payload, buckets, focusMonth, cache);
				const hasActualPerformance = hasActualWeeklyReferenceForSection(turnoverSection, payload, focusMonth)
					&& hasActualWeeklyReferenceForSection(netSection, payload, focusMonth);

				return baseSeries.map(function(week, index) {
					const turnoverWeek = turnoverSeries[index] || { plan: 0, real: 0, forecast: 0 };
					const netWeek = netSeries[index] || { plan: 0, real: 0, forecast: 0 };
					const planValue = normalizeStoredMetricValue(
						Number(netWeek.plan || 0) ? Number(turnoverWeek.plan || 0) / Number(netWeek.plan || 0) : 0,
						'number'
					);
					const realValue = normalizeStoredMetricValue(
						Number(netWeek.real || 0) ? Number(turnoverWeek.real || 0) / Number(netWeek.real || 0) : 0,
						'number'
					);
					const forecastValue = normalizeStoredMetricValue(
						Number(netWeek.forecast || 0) ? Number(turnoverWeek.forecast || 0) / Number(netWeek.forecast || 0) : 0,
						'number'
					);

					return Object.assign({}, week, {
						plan: planValue,
						real: realValue,
						forecast: forecastValue,
						delta: getMetricDeltaValue('number', planValue, realValue, hasActualPerformance, forecastValue),
					});
				});
			}

			function buildWeeklySeriesForSection(section, payload, buckets, focusMonth, cache) {
				const safeCache = cache || {};
				const metricKey = normalizeMetricName(section && section.metric);
				const cacheKey = metricKey + '|' + String(focusMonth || '');
				if (Object.prototype.hasOwnProperty.call(safeCache, cacheKey)) {
					return safeCache[cacheKey];
				}

				const snapshot = getMetricSnapshot(payload, section.metric, focusMonth);
				let weeklySeries = [];
				if (metricKey === normalizeMetricName('Hodiny netto')) {
					weeklySeries = buildWeeklyNetMetricSeries(section, payload, buckets, focusMonth, snapshot, safeCache);
				} else if (metricKey === normalizeMetricName('ÄŚistĂ˝ vĂ˝kon')) {
					weeklySeries = buildWeeklyPerformanceMetricSeries(section, payload, buckets, focusMonth, snapshot, safeCache);
				} else {
					weeklySeries = buildResolvedWeeklyMetricSeries(section, payload, buckets, focusMonth, snapshot);
				}

				safeCache[cacheKey] = weeklySeries;
				return weeklySeries;
			}

			function canEditWeeklyForecastCell(payload, section, focusMonth) {
				const canEdit = Boolean(payload && payload.user && payload.user.role === 'VOD' && payload.scope && payload.scope.type === 'STORE');
				if (!canEdit || !usesUnifiedForecastInput(section)) {
					return false;
				}

				const monthIndex = payload && Array.isArray(payload.months) ? payload.months.indexOf(focusMonth) : -1;
				const realRow = section && Array.isArray(section.rows) ? section.rows.find(function(row) { return row.type === 'real'; }) : null;
				const adjustmentRow = section && Array.isArray(section.rows) ? section.rows.find(function(row) { return row.type === 'adjustment'; }) : null;
				if (monthIndex === -1) {
					return false;
				}

				return !hasActualRealValue(realRow, monthIndex) && !Boolean(adjustmentRow && adjustmentRow.closed && adjustmentRow.closed[monthIndex]);
			}

			function renderWeeklyForecastLine(section, payload, snapshot, values, options) {
				const config = options || {};
				const distributionMode = config.distributionMode || 'split';
				const isEditable = Boolean(config.editable && !config.isSummary);
				if (!isEditable) {
					return renderWeeklyMetricValueLine(getDisplayForecastLabel(), values.forecast, snapshot.format, getForecastCellClass(values.forecast, values.plan), {
						lineClass: 'weekly-metric-line--forecast',
					});
				}

				return '<div class="weekly-metric-line weekly-metric-line--forecast"><span class="weekly-metric-key">' + escapeHtml(getDisplayForecastLabel()) + '</span><input class="weekly-forecast-input" data-weekly-forecast-input="true" data-metric="' + escapeHtml(section.metric) + '" data-month="' + escapeHtml(config.focusMonth || '') + '" data-week-index="' + Number(config.weekIndex || 0) + '" data-day-count="' + Number(config.dayCount || values.dayCount || 0) + '" data-distribution-mode="' + escapeHtml(distributionMode) + '" data-format="' + escapeHtml(snapshot.format || '') + '" value="' + Number(values.forecast || 0) + '"></div>';
			}

			function renderWeeklyMetricValueLine(label, value, format, valueClass, options) {
				const config = options || {};
				const safeTitle = config.title ? ' title="' + escapeHtml(config.title) + '"' : '';
				const lineClass = config.lineClass ? ' ' + config.lineClass : '';
				const isAvailable = config.available !== false;
				const renderedValue = !isAvailable
					? 'â€”'
					: (config.signed ? formatSignedMetric(value, format) : formatMetric(value, format));

				return '<div class="weekly-metric-line' + lineClass + '"><span class="weekly-metric-key">' + escapeHtml(label) + '</span><span class="weekly-metric-value ' + escapeHtml(valueClass || '') + '"' + safeTitle + '>' + renderedValue + '</span></div>';
			}

			function renderWeeklyMetricMatrixCell(section, payload, snapshot, values, options) {
				const config = options || {};
				const realAvailable = Boolean(snapshot.hasReal || snapshot.isRealFallback || Math.abs(Number(values.real || 0)) > 0.0001);
				const lineParts = [];
				if (isRowLayerVisible('plan')) {
					lineParts.push(renderWeeklyMetricValueLine('PlĂˇn', values.plan, snapshot.format, 'plan'));
				}
				if (isRowLayerVisible('real')) {
					lineParts.push(renderWeeklyMetricValueLine('IST', values.real, snapshot.format, snapshot.realTypeClass || 'real', {
						available: realAvailable,
						title: snapshot.realTooltip || '',
					}));
				}
				if (isRowLayerVisible('forecast')) {
					lineParts.push(renderWeeklyForecastLine(section, payload, snapshot, values, config));
				}
				if (isRowLayerVisible('recommendation') && config.recommendationValue != null) {
					lineParts.push(renderWeeklyRecommendationLine(config.recommendationValue, snapshot, values.plan));
				}
				if (isRowLayerVisible('delta')) {
					lineParts.push(renderWeeklyMetricValueLine('Î”', values.delta, snapshot.format, getDeltaCellClass(values.delta), {
						signed: true,
					}));
				}
				if (!lineParts.length) {
					lineParts.push('<div class="weekly-metric-line weekly-metric-line--empty"><span class="weekly-metric-key">Vrstvy skrytĂ©</span></div>');
				}

				return '<td class="' + (config.isSummary ? 'weekly-summary-cell' : 'weekly-metric-cell') + '"><div class="weekly-metric-card"><div class="weekly-metric-stack">'
					+ lineParts.join('')
					+ '</div></div></td>';
			}

			function getWeeklyForecastAggregateValue(values, format, distributionMode) {
				const numericValues = (values || []).map(function(value) {
					return Number(value || 0);
				});
				const weights = Array.prototype.slice.call(arguments[3] || []).map(function(value) {
					return Math.max(1, Number(value || 0));
				});

				if (distributionMode === 'weighted-average') {
					const totalWeight = sumArray(weights);
					const weightedTotal = numericValues.reduce(function(sum, value, index) {
						return sum + (value * Number(weights[index] || 0));
					}, 0);
					return roundPreviewValue(totalWeight ? weightedTotal / totalWeight : averageArray(numericValues), getRoundModeForFormat(format));
				}

				return roundPreviewValue(sumArray(numericValues), getRoundModeForFormat(format));
			}

			function isWeeklyNetRecommendationMetric(metric) {
				return normalizeMetricName(metric) === normalizeMetricName('Hodiny netto');
			}

			function computeNetHoursRecommendationValue(netPlanValue, turnoverPlanValue, turnoverForecastValue, format) {
				const safeNetPlan = Number(netPlanValue || 0);
				const safeTurnoverPlan = Number(turnoverPlanValue || 0);
				const variancePct = safeTurnoverPlan ? (Number(turnoverForecastValue || 0) - safeTurnoverPlan) / safeTurnoverPlan : 0;
				return normalizeStoredMetricValue(safeNetPlan * (1 + (variancePct / 2)), format || 'hours');
			}

			function buildWeeklyNetRecommendationData(payload, focusMonth, buckets, netSnapshot, netWeeklySeries) {
				const turnoverSection = findSectionByMetric(payload, 'Obrat GJ2026');
				if (!turnoverSection) {
					return null;
				}

				const turnoverSnapshot = getMetricSnapshot(payload, 'Obrat GJ2026', focusMonth);
				const persistedTurnoverWeeklyValues = getPersistedWeeklyOverrideValues(payload, 'Obrat GJ2026', focusMonth);
				const turnoverWeeklySeries = applyPendingWeeklyForecastValues(
					turnoverSection,
					turnoverSnapshot,
					focusMonth,
					applyExplicitWeeklyForecastValues(turnoverSnapshot, buildWeeklyMetricSeries(turnoverSnapshot, buckets), persistedTurnoverWeeklyValues)
				);
				const turnoverSummary = buildWeeklyAggregateSnapshotValues(turnoverSnapshot, turnoverWeeklySeries, getWeeklyDistributionMode(turnoverSnapshot), payload);
				const netSummary = buildWeeklyAggregateSnapshotValues(netSnapshot, netWeeklySeries || [], getWeeklyDistributionMode(netSnapshot), payload);

				return {
					weeks: (netWeeklySeries || []).map(function(weekValues, index) {
						const turnoverWeek = turnoverWeeklySeries[index] || { plan: 0, forecast: 0 };
						return computeNetHoursRecommendationValue(
							weekValues.plan,
							turnoverWeek.plan,
							turnoverWeek.forecast,
							netSnapshot && netSnapshot.format
						);
					}),
					total: computeNetHoursRecommendationValue(
						netSummary.plan,
						turnoverSummary.plan,
						turnoverSummary.forecast,
						netSnapshot && netSnapshot.format
					),
				};
			}

			function renderWeeklyRecommendationLine(value, snapshot, planValue) {
				return renderWeeklyMetricValueLine('Doporucenie Vzorca', value, snapshot.format, 'recommendation ' + getForecastCellClass(value, planValue), {
					title: 'Ak je obrat v tĂ˝Ĺľdni o x % voÄŤi plĂˇnu, hodiny netto idĂş odporĂşÄŤane o x/2 % voÄŤi plĂˇnu.',
				});
			}

			function applyPendingWeeklyForecastValues(section, snapshot, focusMonth, weeklySeries) {
				const pendingValues = getPendingWeeklyAdjustmentValues(section.metric, focusMonth);
				if (!Array.isArray(pendingValues) || pendingValues.length !== weeklySeries.length) {
					return weeklySeries;
				}

				const monthIndex = state.dashboard && Array.isArray(state.dashboard.months) ? state.dashboard.months.indexOf(focusMonth) : -1;
				const realRow = section && Array.isArray(section.rows) ? section.rows.find(function(row) { return row.type === 'real'; }) : null;
				const hasActualMonthReal = monthIndex > -1 && hasActualRealValue(realRow, monthIndex);

				return weeklySeries.map(function(weekValues, index) {
					const forecastValue = Number(pendingValues[index] || 0);
					const referenceValue = hasActualMonthReal ? Number(weekValues.real || 0) : Number(weekValues.plan || 0);
					return Object.assign({}, weekValues, {
						forecast: forecastValue,
						delta: normalizeStoredMetricValue(forecastValue - referenceValue, snapshot.format),
					});
				});
			}

			function ensureWeeklyOverridesForView(payload, options) {
				const config = options || {};
				if (!payload || !payload.scope || !Array.isArray(payload.scope.storeIds) || !payload.scope.storeIds.length) {
					return;
				}

				const focusMonth = config.month || getWeeklyFocusMonth(payload);
				const cacheKey = buildWeeklyOverridesCacheKey(payload.scope.id, focusMonth);
				if (!focusMonth || state.weeklyOverridesCache[cacheKey] || state.weeklyOverridesLoading[cacheKey]) {
					return;
				}

				state.weeklyOverridesLoading[cacheKey] = true;
				google.script.run
					.withSuccessHandler(function(result) {
						state.weeklyOverridesCache[cacheKey] = normalizeWeeklyOverridesPayload(result, payload.scope.id, focusMonth);
						delete state.weeklyOverridesLoading[cacheKey];
						if (config.rerenderOnReady !== false && getActiveTableView() === 'weekly' && state.dashboard && state.dashboard.scope.id === payload.scope.id && getWeeklyFocusMonth(getActiveDashboard()) === focusMonth) {
							renderMetricTable(getActiveDashboard());
						}
					})
					.withFailureHandler(function() {
						state.weeklyOverridesCache[cacheKey] = normalizeWeeklyOverridesPayload(null, payload.scope.id, focusMonth);
						delete state.weeklyOverridesLoading[cacheKey];
						if (config.rerenderOnReady !== false && getActiveTableView() === 'weekly' && state.dashboard && state.dashboard.scope.id === payload.scope.id && getWeeklyFocusMonth(getActiveDashboard()) === focusMonth) {
							renderMetricTable(getActiveDashboard());
						}
					})
					.getWeeklyVodOverrides(state.loginValue, payload.scope.id, focusMonth);
			}

			function preloadWeeklyOverrides(payload) {
				if (!payload) {
					return;
				}

				ensureWeeklyOverridesForView(payload, {
					month: getWeeklyFocusMonth(payload),
					rerenderOnReady: false,
				});
			}

			function buildWeeklyOverridesCacheKey(scopeId, month) {
				return String(scopeId || '') + '|' + String(month || '');
			}

			function normalizeWeeklyOverridesPayload(payload, scopeId, month) {
				const normalized = {
					scopeId: scopeId,
					month: month,
					overrides: normalizeWeeklyOverrideEntries_(payload && payload.overrides ? payload.overrides : {}),
					storeOverrides: {},
				};
				const storeSource = payload && payload.storeOverrides ? payload.storeOverrides : {};
				Object.keys(storeSource).forEach(function(storeId) {
					normalized.storeOverrides[String(storeId || '').trim()] = normalizeWeeklyOverrideEntries_(storeSource[storeId]);
				});
				return normalized;
			}

			function normalizeWeeklyOverrideEntries_(source) {
				const normalizedEntries = {};
				Object.keys(source || {}).forEach(function(metric) {
					normalizedEntries[normalizeMetricName(metric)] = {
						values: Array.isArray(source[metric].values) ? source[metric].values.map(function(value) { return Number(value || 0); }) : [],
						distributionMode: String(source[metric].distributionMode || '').trim(),
					};
				});
				return normalizedEntries;
			}

			function getPersistedWeeklyOverrideValues(payload, metric, month) {
				if (!payload || !payload.scope) {
					return null;
				}

				if (shouldIgnorePersistedWeeklyOverrides(metric, month)) {
					return null;
				}

				const cacheKey = buildWeeklyOverridesCacheKey(payload.scope.id, month);
				const cached = state.weeklyOverridesCache[cacheKey];
				if (!cached || !cached.overrides) {
					return null;
				}

				const entry = cached.overrides[normalizeMetricName(metric)];
				return entry && Array.isArray(entry.values) ? entry.values.slice() : null;
			}

			function getPersistedWeeklyOverrideValuesForStore(payload, storeId, metric, month) {
				if (!payload || !payload.scope) {
					return null;
				}

				const cacheKey = buildWeeklyOverridesCacheKey(payload.scope.id, month);
				const cached = state.weeklyOverridesCache[cacheKey];
				const normalizedStoreId = String(storeId || '').trim();
				if (!cached || !cached.storeOverrides || !cached.storeOverrides[normalizedStoreId]) {
					return null;
				}

				const entry = cached.storeOverrides[normalizedStoreId][normalizeMetricName(metric)];
				return entry && Array.isArray(entry.values) ? entry.values.slice() : null;
			}

			function applyExplicitWeeklyForecastValues(snapshot, weeklySeries, explicitValues) {
				if (!Array.isArray(explicitValues) || explicitValues.length !== weeklySeries.length) {
					return weeklySeries;
				}

				const hasActualMonthReal = Boolean(snapshot && snapshot.hasReal && !snapshot.isRealFallback);
				return weeklySeries.map(function(weekValues, index) {
					const forecastValue = Number(explicitValues[index] || 0);
					const referenceValue = hasActualMonthReal ? Number(weekValues.real || 0) : Number(weekValues.plan || 0);
					return Object.assign({}, weekValues, {
						forecast: forecastValue,
						delta: normalizeStoredMetricValue(forecastValue - referenceValue, snapshot.format),
					});
				});
			}

			function buildWeeklyAggregateSnapshotValues(snapshot, weeklySeries, distributionMode, payload) {
				if (snapshot && normalizeMetricName(snapshot.metric) === normalizeMetricName('ÄŚistĂ˝ vĂ˝kon') && payload) {
					const focusMonth = getWeeklyFocusMonth(payload);
					const buckets = buildMonthWeekBuckets(focusMonth);
					const weeklySeriesCache = {};
					const turnoverSection = findSectionByMetric(payload, 'Obrat GJ2026');
					const netSection = findSectionByMetric(payload, 'Hodiny netto');
					if (turnoverSection && netSection) {
						const turnoverSnapshot = getMetricSnapshot(payload, 'Obrat GJ2026', focusMonth);
						const netSnapshot = getMetricSnapshot(payload, 'Hodiny netto', focusMonth);
						const turnoverSummary = buildWeeklyAggregateSnapshotValues(
							turnoverSnapshot,
							buildWeeklySeriesForSection(turnoverSection, payload, buckets, focusMonth, weeklySeriesCache),
							getWeeklyDistributionMode(turnoverSnapshot),
							payload
						);
						const netSummary = buildWeeklyAggregateSnapshotValues(
							netSnapshot,
							buildWeeklySeriesForSection(netSection, payload, buckets, focusMonth, weeklySeriesCache),
							getWeeklyDistributionMode(netSnapshot),
							payload
						);
						const planValue = normalizeStoredMetricValue(
							Number(netSummary.plan || 0) ? Number(turnoverSummary.plan || 0) / Number(netSummary.plan || 0) : 0,
							'number'
						);
						const realValue = normalizeStoredMetricValue(
							Number(netSummary.real || 0) ? Number(turnoverSummary.real || 0) / Number(netSummary.real || 0) : 0,
							'number'
						);
						const forecastValue = normalizeStoredMetricValue(
							Number(netSummary.forecast || 0) ? Number(turnoverSummary.forecast || 0) / Number(netSummary.forecast || 0) : 0,
							'number'
						);
						return {
							plan: planValue,
							real: realValue,
							forecast: forecastValue,
							delta: getMetricDeltaValue('number', planValue, realValue, Boolean(snapshot && snapshot.hasReal && !snapshot.isRealFallback), forecastValue),
						};
					}
				}

				const weights = (weeklySeries || []).map(function(weekValues) {
					return Math.max(1, Number(weekValues.dayCount || 0));
				});
				const planValue = getWeeklyForecastAggregateValue((weeklySeries || []).map(function(weekValues) { return weekValues.plan; }), snapshot.format, distributionMode, weights);
				const realValue = getWeeklyForecastAggregateValue((weeklySeries || []).map(function(weekValues) { return weekValues.real; }), snapshot.format, distributionMode, weights);
				const forecastValue = getWeeklyForecastAggregateValue((weeklySeries || []).map(function(weekValues) { return weekValues.forecast; }), snapshot.format, distributionMode, weights);
				return {
					plan: planValue,
					real: realValue,
					forecast: forecastValue,
					delta: getMetricDeltaValue(snapshot.format, planValue, realValue, Boolean(snapshot && snapshot.hasReal && !snapshot.isRealFallback), forecastValue),
				};
			}

			function renderWeeklyCompactMetricTable(payload) {
				const container = document.getElementById('metricTableContainer');
				const focusMonth = getWeeklyFocusMonth(payload);
				const buckets = buildMonthWeekBuckets(focusMonth);
				const filteredSections = getWeeklyCompactMetricSections(payload);
				const isWeeklyLoading = isWeeklyOverridesLoadingForView(payload, focusMonth);
				const weeklySeriesCache = {};

				if (!filteredSections.length) {
					container.innerHTML = '<section class="metric-section"><div class="metric-heading">Ĺ˝iadny ukazovateÄľ</div><div style="padding: 18px;" class="tiny">Pre zvolenĂ˝ filter sa nenaĹˇli Ĺľiadne metriky.</div></section>';
					return;
				}

				const tableHead = '<div class="metric-table-scroll"><table class="weekly-compact-table"><thead><tr><th>UkazovateÄľ</th>'
					+ buckets.map(function(bucket) {
						return '<th><div class="weekly-header-stack"><span class="weekly-header-main">' + escapeHtml(bucket.label) + '</span><span class="weekly-header-sub">' + escapeHtml(bucket.rangeLabel) + '</span></div></th>';
					}).join('')
					+ '<th><div class="weekly-header-stack"><span class="weekly-header-main">SumĂˇr</span><span class="weekly-header-sub">Mesiac</span></div></th></tr></thead><tbody>';

				const tableRows = filteredSections.map(function(section) {
					const snapshot = getMetricSnapshot(payload, section.metric, focusMonth);
					const distributionMode = getWeeklyDistributionMode(snapshot);
					const weeklySeries = buildWeeklySeriesForSection(section, payload, buckets, focusMonth, weeklySeriesCache);
					const monthlySummaryValues = buildWeeklyAggregateSnapshotValues(snapshot, weeklySeries, distributionMode, payload);
					const netRecommendationData = isWeeklyNetRecommendationMetric(section.metric)
						? buildWeeklyNetRecommendationData(payload, focusMonth, buckets, snapshot, weeklySeries)
						: null;
					const isCollapsed = isMetricCollapsed(section.metric);
					const isEditable = canEditWeeklyForecastCell(payload, section, focusMonth);
					const toggleLabel = isCollapsed ? 'RozbaliĹĄ' : 'ZbaliĹĄ';
					const monthMetaParts = [formatMonthShort(focusMonth)];
					if (shouldRenderWeeklyStoreBreakdown(payload, section)) {
						monthMetaParts.push('rozbalenie po filiĂˇlkach');
					}
					const monthMeta = monthMetaParts.join(' â€˘ ');
					const collapsedMetricLabel = getCollapsedWeeklyMetricLabel(section.metric);
					const labelCell = '<td class="weekly-metric-label-cell"><div class="weekly-metric-label-head"><div class="weekly-metric-name">' + escapeHtml(getMetricDisplayLabel(section.metric)) + '</div><div class="weekly-metric-actions"><button class="metric-toggle weekly-toggle" type="button" data-toggle-metric="' + escapeHtml(section.metric) + '" aria-expanded="' + (isCollapsed ? 'false' : 'true') + '">' + escapeHtml(toggleLabel) + '</button></div></div><div class="weekly-metric-sub">' + escapeHtml(monthMeta) + '</div></td>';

					if (isCollapsed) {
						return '<tr class="weekly-collapsed-row"><td class="weekly-metric-label-cell weekly-metric-label-cell--collapsed" colspan="' + (buckets.length + 2) + '"><div class="weekly-metric-label-head"><div class="weekly-metric-name weekly-metric-name--collapsed" title="' + escapeHtml(section.metric) + '">' + escapeHtml(collapsedMetricLabel) + '</div><div class="weekly-metric-actions"><button class="metric-toggle weekly-toggle" type="button" data-toggle-metric="' + escapeHtml(section.metric) + '" aria-expanded="false">RozbaliĹĄ</button></div></div></td></tr>';
					}

					const mainRow = '<tr>' + labelCell
						+ weeklySeries.map(function(weekValues) {
							return renderWeeklyMetricMatrixCell(section, payload, snapshot, weekValues, {
								focusMonth: focusMonth,
								weekIndex: weekValues.index,
								dayCount: weekValues.dayCount,
								distributionMode: distributionMode,
								recommendationValue: netRecommendationData ? netRecommendationData.weeks[weekValues.index] : null,
								editable: isEditable,
								isSummary: false,
							});
						}).join('')
						+ renderWeeklyMetricMatrixCell(section, payload, snapshot, monthlySummaryValues, {
							focusMonth: focusMonth,
							distributionMode: distributionMode,
							recommendationValue: netRecommendationData ? netRecommendationData.total : null,
							editable: false,
							isSummary: true,
						})
						+ '</tr>';
					const breakdownRow = renderWeeklyStoreBreakdownBlock(section, payload, buckets, focusMonth);
					return mainRow + breakdownRow;
				}).join('');

				container.innerHTML = '<section class="metric-section metric-section--weekly-compact"><div class="metric-section-body">'
					+ (isWeeklyLoading ? '<div class="weekly-loading-indicator" aria-live="polite">NaÄŤĂ­tavam uloĹľenĂ© tĂ˝ĹľdennĂ© Ăşpravy pre ' + escapeHtml(formatMonthShort(focusMonth)) + '.</div>' : '')
					+ tableHead + tableRows + '</tbody></table></div></section>';

				container.querySelectorAll('[data-toggle-metric]').forEach(function(button) {
					button.addEventListener('click', function() {
						toggleMetricCollapsed(this.dataset.toggleMetric);
					});
				});

				container.querySelectorAll('[data-weekly-forecast-input]').forEach(function(input) {
					input.addEventListener('change', function() {
						const metric = this.dataset.metric;
						const month = this.dataset.month;
						const distributionMode = this.dataset.distributionMode || 'split';
						const format = this.dataset.format || 'number';
						const metricInputs = Array.prototype.slice.call(container.querySelectorAll('[data-weekly-forecast-input]')).filter(function(item) {
							return item.dataset.metric === metric && item.dataset.month === month;
						});
						const dayWeights = metricInputs.map(function(item) {
							return Number(item.dataset.dayCount || 0);
						});
						const normalizedInputValue = roundPreviewValue(Number(this.value || 0), getRoundModeForFormat(format));
						this.value = normalizedInputValue;

						if (!state.pendingAdjustments[metric]) {
							state.pendingAdjustments[metric] = {};
						}

						const weeklyValues = metricInputs.map(function(item) {
							return Number(item.value || 0);
						});
						setPendingWeeklyAdjustmentValues(metric, month, weeklyValues);
						state.pendingAdjustments[metric][month] = getWeeklyForecastAggregateValue(weeklyValues, format, distributionMode, dayWeights);

						refreshLocalPreview();
					});
				});
			}

			function isWeeklyOverridesLoadingForView(payload, focusMonth) {
				if (!payload || !payload.scope) {
					return false;
				}

				const cacheKey = buildWeeklyOverridesCacheKey(payload.scope.id, focusMonth || getWeeklyFocusMonth(payload));
				return Boolean(cacheKey && state.weeklyOverridesLoading[cacheKey]);
			}

			function shouldRenderWeeklyStoreBreakdown(payload, section) {
				return Boolean(
					payload
					&& payload.scope
					&& payload.scope.type !== 'STORE'
					&& section
					&& Array.isArray(section.breakdown)
					&& section.breakdown.length
				);
			}

			function buildSectionMetricSnapshot(section, month, months) {
				if (!section || !Array.isArray(section.rows)) {
					return buildEmptyMetricSnapshot(section && section.metric ? section.metric : '');
				}

				return buildStandardMetricSnapshot(section, {
					month: month,
					months: Array.isArray(months) ? months : [],
				});
			}

			function renderWeeklyStoreBreakdownBlock(section, payload, buckets, focusMonth) {
				if (!shouldRenderWeeklyStoreBreakdown(payload, section)) {
					return '';
				}

				const safeBuckets = Array.isArray(buckets) ? buckets : [];
				const safeMonths = payload && Array.isArray(payload.months) ? payload.months : [];
				const colSpan = safeBuckets.length + 2;
				function getBreakdownLabel(item) {
					return String(item.displayLabel || '').trim() || formatStoreDisplayLabel(item.storeId, item.storeName);
				}

				function renderWeeklyBreakdownTable(items, firstColumnLabel) {
					const breakdownHead = '<div class="metric-table-scroll"><table class="breakdown-table weekly-breakdown-table"><thead><tr><th>' + escapeHtml(firstColumnLabel) + '</th>'
						+ safeBuckets.map(function(bucket) {
							return '<th><div class="weekly-header-stack"><span class="weekly-header-main">' + escapeHtml(bucket.label) + '</span><span class="weekly-header-sub">' + escapeHtml(bucket.rangeLabel) + '</span></div></th>';
						}).join('')
						+ '<th><div class="weekly-header-stack"><span class="weekly-header-main">SumĂˇr</span><span class="weekly-header-sub">Mesiac</span></div></th></tr></thead><tbody>';

					const breakdownRows = items.map(function(item) {
						const itemSection = {
							metric: section.metric,
							format: section.format,
							rows: Array.isArray(item.rows) ? item.rows : [],
						};
						const itemSnapshot = buildSectionMetricSnapshot(itemSection, focusMonth, safeMonths);
						const distributionMode = getWeeklyDistributionMode(itemSnapshot);
						const persistedWeeklyValues = getPersistedWeeklyOverrideValuesForStore(payload, item.storeId, section.metric, focusMonth);
						const weeklySeries = applyExplicitWeeklyForecastValues(
							itemSnapshot,
							buildWeeklyMetricSeries(itemSnapshot, safeBuckets),
							persistedWeeklyValues
						);
						const summaryValues = normalizeMetricName(section.metric) === normalizeMetricName('ÄŚistĂ˝ vĂ˝kon')
							? {
								plan: Number(itemSnapshot.plan || 0),
								real: Number(itemSnapshot.real || 0),
								forecast: Number(itemSnapshot.forecast || 0),
								delta: Number(itemSnapshot.delta || 0),
							}
							: buildWeeklyAggregateSnapshotValues(itemSnapshot, weeklySeries, distributionMode, payload);
						var rowHtml = '<tr><td class="store-name-cell">' + escapeHtml(getBreakdownLabel(item)) + '</td>'
							+ weeklySeries.map(function(weekValues) {
								return renderWeeklyMetricMatrixCell(itemSection, payload, itemSnapshot, weekValues, {
									focusMonth: focusMonth,
									distributionMode: distributionMode,
									editable: false,
									isSummary: false,
								});
							}).join('')
							+ renderWeeklyMetricMatrixCell(itemSection, payload, itemSnapshot, summaryValues, {
								focusMonth: focusMonth,
								distributionMode: distributionMode,
								editable: false,
								isSummary: true,
							})
							+ '</tr>';

						if (Array.isArray(item.breakdown) && item.breakdown.length) {
							rowHtml += '<tr><td colspan="' + (safeBuckets.length + 2) + '"><details class="breakdown-panel breakdown-panel--nested"><summary class="breakdown-toggle">RozbaliĹĄ po filiĂˇlkach (' + Number(item.breakdown.length || 0) + ')</summary><div class="breakdown-content">'
								+ renderWeeklyBreakdownTable(item.breakdown, 'FiliĂˇlka')
								+ '</div></details></td></tr>';
						}

						return rowHtml;
					}).join('');

					return breakdownHead + breakdownRows + '</tbody></table></div>';
				}

				const firstColumnLabel = section.breakdown.some(function(item) { return Array.isArray(item.breakdown) && item.breakdown.length; }) ? 'VKL' : 'FiliĂˇlka';
				return '<tr class="weekly-breakdown-row"><td colspan="' + colSpan + '"><details class="breakdown-panel"><summary class="breakdown-toggle">RozbaliĹĄ po filiĂˇlkach (' + Number(section.breakdown.length || 0) + ')</summary><div class="breakdown-content">'
					+ renderWeeklyBreakdownTable(section.breakdown, firstColumnLabel) + '</div></details></td></tr>';
			}

			function renderMetricTableHeading(payload) {
				const activeView = getActiveTableView();
				const titleNode = document.getElementById('metricTableTitle');
				const metaNode = document.getElementById('metricTableModeMeta');
				const viewConfig = TABLE_VIEWS[activeView] || TABLE_VIEWS.monthly;
				let metaText = viewConfig.description;

				if (activeView === 'weekly') {
					const focusMonth = getWeeklyFocusMonth(payload);
					const weekBuckets = buildMonthWeekBuckets(focusMonth);
					metaText = 'Fokus: ' + formatMonthShort(focusMonth) + ' â€˘ ' + weekBuckets.length + ' kalendĂˇrnych tĂ˝ĹľdĹov â€˘ mesaÄŤnĂ˝ sumĂˇr ostĂˇva v pravom stÄşpci.';
				}

				titleNode.textContent = viewConfig.title;
				metaNode.textContent = metaText;
				renderTableViewControls(activeView);
				renderRowVisibilityControls(activeView);
			}

			function getVisibleMonthEntries(months) {
				const monthList = Array.isArray(months) ? months : [];
				const allEntries = monthList.map(function(month, index) {
					return { month: month, index: index };
				});
				const width = getViewportWidth();

				if (width <= 1240) {
					return allEntries;
				}

				if (width >= 1440) {
					return allEntries;
				}

				const focusedMonth = getFocusedMonthForCompactTables(monthList);
				const focusedIndex = Math.max(0, monthList.indexOf(focusedMonth));
				const radius = width >= 1280 ? 3 : width >= 1080 ? 2 : width >= 900 ? 1 : 0;
				const startIndex = Math.max(0, focusedIndex - radius);
				const endIndex = Math.min(monthList.length - 1, focusedIndex + radius);

				return allEntries.filter(function(entry) {
					return entry.index >= startIndex && entry.index <= endIndex;
				});
			}

			function renderMetricTable(payload) {
				renderMetricTableHeading(payload);
				if (getActiveTableView() === 'weekly') {
					ensureWeeklyOverridesForView(payload);
					setMetricCollapseControlsVisibility(true);
					renderMetricCollapseControls(payload);
					renderWeeklyCompactMetricTable(payload);
					return;
				}

				setMetricCollapseControlsVisibility(true);
				const canEdit = payload.user.role === 'VOD' && payload.scope.type === 'STORE';
				const workingDaysByMonth = resolveWorkingDaysForStructure(payload.table, payload.months);
				const focusedMonth = getFocusedMonthForCompactTables(payload.months);
				const visibleMonthEntries = getVisibleMonthEntries(payload.months);
				const filteredSections = getFilteredMetricSections(payload);
				const container = document.getElementById('metricTableContainer');
				const getFocusedMonthCellClass = function(month) {
					return month === focusedMonth ? 'metric-month-cell is-focused' : '';
				};
				const appendCellClass = function(html, className) {
					if (!className) {
						return html;
					}
					if (html.indexOf('<td class="') === 0) {
						return html.replace('<td class="', '<td class="' + className + ' ');
					}
					if (html.indexOf('<td ') === 0) {
						return html.replace('<td ', '<td class="' + className + '" ');
					}
					return html.replace('<td>', '<td class="' + className + '">');
				};
				renderMetricCollapseControls(payload);
				container.innerHTML = filteredSections.map(function(section) {
					const isCollapsed = isMetricCollapsed(section.metric);
					const sectionPlanRow = section.rows.find(function(row) { return row.type === 'plan'; }) || { values: [], total: 0 };
					const sectionRealRow = section.rows.find(function(row) { return row.type === 'real'; }) || { values: [] };
					const sectionAdjustmentRow = section.rows.find(function(row) { return row.type === 'adjustment'; }) || { values: [], total: 0, closed: [] };
					const usesForecastInput = canEdit && usesUnifiedForecastInput(section);
					const displayRows = filterVisibleDisplayRows(buildDisplayRowsForSection(section, payload.months, workingDaysByMonth, {
						scopeType: payload.scope && payload.scope.type,
						table: payload.table,
					}));
					const compactMonthsLabel = visibleMonthEntries.length !== payload.months.length
						? 'ZobrazenĂ© mesiace: ' + visibleMonthEntries.map(function(entry) { return formatMonthShort(entry.month); }).join(' â€˘ ')
						: '';
					const headerMeta = [compactMonthsLabel, section.breakdown && section.breakdown.length ? 'VKL/GF drill-down po filiĂˇlkach' : ''].filter(Boolean).join(' â€˘ ');
					const toggleLabel = isCollapsed ? 'RozbaliĹĄ' : 'ZbaliĹĄ';
					const compareToolbar = isWorkforceStructureMetric(section.metric) ? '<div class="metric-toolbar-row">' + renderStructureCompareToggle() + '</div>' : '';
					const header = '<div class="metric-heading"><div class="metric-header-row"><div class="metric-title-stack"><div class="metric-title-group"><span>' + escapeHtml(getMetricDisplayLabel(section.metric)) + '</span></div>'
						+ (headerMeta ? '<span class="tiny">' + escapeHtml(headerMeta) + '</span>' : '')
						+ '</div><div class="metric-actions"><button class="metric-toggle" type="button" data-toggle-metric="' + escapeHtml(section.metric) + '" aria-expanded="' + (isCollapsed ? 'false' : 'true') + '">' + toggleLabel + '</button></div>'
						+ '</div>' + compareToolbar + '</div>';
					const tableHead = '<div class="metric-table-scroll"><table><thead><tr><th>Obdobie</th>'
						+ visibleMonthEntries.map(function(entry) { return '<th class="metric-month-head' + (entry.month === focusedMonth ? ' is-focused' : '') + '">' + escapeHtml(formatMonthShort(entry.month)) + '</th>'; }).join('')
						+ '<th>SumĂˇr roka</th>'
						+ '</tr></thead><tbody>';

					const renderCell = function(row, entry) {
						const value = row.values[entry.index];
						const month = entry.month;
						const fmt = row.displayFormat || section.format;
						const focusedCellClass = getFocusedMonthCellClass(month);
						switch (row.type) {
							case 'structure-mix':
								return appendCellClass(renderStructureMixCell(value, month, canEdit, getWorkingDaysForStructureMonth(month, entry.index, workingDaysByMonth)), focusedCellClass);
							case 'structure-days':
								return '<td class="' + focusedCellClass + '">' + formatMetric(value, row.displayFormat || 'fte') + '</td>';
							case 'static-plan':
							case 'workforce-total':
							case 'structure-hours-derived':
							case 'structure-hours-plan':
								return '<td class="' + focusedCellClass + '">' + formatMetric(value, fmt) + '</td>';
							case 'structure-hours-real':
								return value == null ? '<td class="' + focusedCellClass + ' ist-zero-fill" title="IST eĹˇte nie je k dispozĂ­cii">' + formatMetric(0, row.displayFormat || 'hours') + '</td>' : '<td class="' + focusedCellClass + '">' + formatMetric(value, row.displayFormat || 'hours') + '</td>';
							case 'delta':
							case 'recommendation':
								return '<td class="' + focusedCellClass + ' ' + getDeltaCellClass(value) + '"><span class="delta-value">' + formatSignedMetric(value, section.format) + '</span></td>';
							case 'vacation-guide':
								return '<td class="' + focusedCellClass + '">' + formatMetric(value, section.format) + '</td>';
							case 'recommendation-result':
								return appendCellClass(renderForecastTableCell(value, sectionPlanRow.values[entry.index], section.format), focusedCellClass);
							case 'forecast':
								if (usesForecastInput) {
									const disabled = hasActualRealValue(sectionRealRow, entry.index) || Boolean(sectionAdjustmentRow.closed && sectionAdjustmentRow.closed[entry.index]);
									return '<td class="' + focusedCellClass + '"><input class="editable-cell editable-forecast-cell" data-metric="' + escapeHtml(section.metric) + '" data-month="' + escapeHtml(month) + '" value="' + Number(value || 0) + '" ' + (disabled ? 'disabled' : '') + '></td>';
								}
								return appendCellClass(renderForecastTableCell(value, sectionPlanRow.values[entry.index], section.format), focusedCellClass);
							case 'real':
								return appendCellClass(renderRealTableCell(section, row, value, entry.index), focusedCellClass);
							default:
								return '<td class="' + focusedCellClass + '">' + formatMetric(value, section.format) + '</td>';
						}
					};

					const tableRows = displayRows.length
						? displayRows.map(function(row) {
							return '<tr data-row-type="' + row.type + '"><td>' + escapeHtml(getDisplayRowLabel(row)) + '</td>'
								+ visibleMonthEntries.map(function(entry) {
									return renderCell(row, entry);
								}).join('')
								+ renderMetricYearTotalCell(row, section.format, sectionPlanRow.total, section)
								+ '</tr>';
						}).join('')
						: '<tr class="rows-hidden-placeholder"><td colspan="' + (visibleMonthEntries.length + 2) + '">VybranĂ© vrstvy sĂş skrytĂ©.</td></tr>';

					const breakdownBlock = renderBreakdownBlock(section, payload.months, visibleMonthEntries, workingDaysByMonth);

					return '<section class="metric-section' + (isCollapsed ? ' is-collapsed' : '') + '">' + header + '<div class="metric-section-body">' + tableHead + tableRows + '</tbody></table></div>' + breakdownBlock + '</div></section>';
				}).join('') || '<section class="metric-section"><div class="metric-heading">Ĺ˝iadny ukazovateÄľ</div><div style="padding: 18px;" class="tiny">Pre zvolenĂ˝ filter sa nenaĹˇli Ĺľiadne metriky.</div></section>';

				container.querySelectorAll('.editable-cell').forEach(function(input) {
					input.addEventListener('change', function() {
						const metric = this.dataset.metric;
						const month = this.dataset.month;
						if (!state.pendingAdjustments[metric]) {
							state.pendingAdjustments[metric] = {};
						}
						state.pendingAdjustments[metric][month] = Number(this.value || 0);
						removePendingWeeklyAdjustmentValues(metric, month);
						refreshLocalPreview();
					});
				});

				container.querySelectorAll('.structure-mix-input').forEach(function(input) {
					input.addEventListener('change', function() {
						const metric = this.dataset.mixMetric;
						const month = this.dataset.month;
						const cell = this.closest('.structure-mix-cell');
						if (!state.pendingAdjustments[metric]) {
							state.pendingAdjustments[metric] = {};
						}
						state.pendingAdjustments[metric][month] = Number(this.value || 0);
						updateStructureDerivedAdjustments(cell, month);
						refreshLocalPreview();
					});
				});

				container.querySelectorAll('[data-structure-compare-mode]').forEach(function(button) {
					button.addEventListener('click', function() {
						setStructureMixCompareMode(this.dataset.structureCompareMode);
					});
				});

				container.querySelectorAll('[data-toggle-metric]').forEach(function(button) {
					button.addEventListener('click', function() {
						toggleMetricCollapsed(this.dataset.toggleMetric);
					});
				});
			}

			function openNoteModal() {
				state.activeNoteMetric = GLOBAL_SCOPE_NOTE_KEY;
				renderNoteModal();
				document.getElementById('noteModalBackdrop').classList.remove('hidden');
				ensureNoteModalNotesLoaded(state.dashboard);
			}

			function closeNoteModal() {
				document.getElementById('noteModalBackdrop').classList.add('hidden');
			}

			function renderNoteModal() {
				if (!state.dashboard) {
					return;
				}

				const noteScopeText = state.dashboard.scope.type === 'STORE'
					? 'SpoloÄŤnĂ˝ priestor pre VKL a VOD pre tĂşto filiĂˇlku: ' + state.dashboard.scope.label
					: 'SpoloÄŤnĂ˝ priestor pre VKL a VOD v scope: ' + state.dashboard.scope.label;
				document.getElementById('noteModalTitle').textContent = 'PoznĂˇmky pre ' + state.dashboard.scope.label;
				document.getElementById('noteModalMeta').textContent = noteScopeText;
				document.getElementById('noteModalContent').innerHTML = renderNoteModalCards(state.dashboard, getCachedMetricNotes(GLOBAL_SCOPE_NOTE_KEY), isMetricNotesLoading(GLOBAL_SCOPE_NOTE_KEY));

				document.querySelectorAll('[data-vkl-note-scope-mode]').forEach(function(button) {
					button.addEventListener('click', function() {
						const requestedMode = this.dataset.vklNoteScopeMode === 'vkl' ? 'vkl' : 'store';
						if (requestedMode === getCurrentVklNoteTargetForRequest()) {
							return;
						}
						state.vklNoteScopeMode = requestedMode;
						renderNoteModal();
						renderScopeNotesIndicator();
						ensureNoteModalNotesLoaded(state.dashboard);
					});
				});

				document.querySelectorAll('.note-textarea').forEach(function(input) {
					input.addEventListener('input', function() {
						state.pendingNotes[buildPendingNoteKey(this.dataset.metric, this.dataset.role, this.dataset.noteScopeMode)] = this.value;
						renderScopeNotesIndicator();
					});
				});
			}

			function renderNoteModalCards(payload, notes, isLoading) {
				if (isLoading) {
					return '<div class="note-card"><h4>NaÄŤĂ­tavam poznĂˇmky</h4><div class="note-meta">ÄŚĂ­tam aktuĂˇlne poznĂˇmky z Google Sheets.</div></div>';
				}

				const resolvedNotes = notes || { VOD: {}, VKL: {} };
				const metrics = getNoteModalMetrics(payload);
				const canEditVod = payload.user.role === 'VOD' && payload.scope.type === 'STORE';
				const canEditVkl = payload.user.role === 'VKL';
				const isStoreScope = payload.scope.type === 'STORE';
				const isVklStoreScope = payload.user.role === 'VKL' && isStoreScope;
				const currentVklMode = getCurrentVklNoteTargetForRequest();
				const vodPlaceholder = isStoreScope
					? 'Sem si VOD zapisuje body, kontext a follow-upy pre tĂşto filiĂˇlku.'
					: 'Sem si VOD zapisuje body, kontext a follow-upy pre aktuĂˇlny agregĂˇt.';
				const vklPlaceholder = isStoreScope && currentVklMode === 'vkl'
					? 'Sem si VKL zapisuje body, priority a Ăşlohy pre celĂ˝ svoj VKL. TĂşto poznĂˇmku uvidia vĹˇetky filiĂˇlky tohto VKL.'
					: isStoreScope
					? 'Sem si VKL zapisuje body, priority a Ăşlohy len pre tĂşto jednu filiĂˇlku.'
					: 'Sem si VKL zapisuje body, priority a Ăşlohy pre celĂ˝ aktuĂˇlny VKL scope.';
				const vklToggle = isVklStoreScope
					? '<div class="note-scope-toggle" role="tablist" aria-label="Rozsah VKL poznĂˇmky">'
						+ '<button class="note-scope-option' + (currentVklMode === 'store' ? ' is-active' : '') + '" type="button" data-vkl-note-scope-mode="store">Len tĂˇto filiĂˇlka</button>'
						+ '<button class="note-scope-option' + (currentVklMode === 'vkl' ? ' is-active' : '') + '" type="button" data-vkl-note-scope-mode="vkl">CelĂ˝ VKL</button>'
						+ '</div>'
					: '';

				return renderSingleNoteCard('VOD', GLOBAL_SCOPE_NOTE_KEY, resolvedNotes.VOD || {}, canEditVod, vodPlaceholder, '', 'scope', renderMetricNoteRows('VOD', metrics, 'scope'))
					+ renderSingleNoteCard('VKL', GLOBAL_SCOPE_NOTE_KEY, resolvedNotes.VKL || {}, canEditVkl, vklPlaceholder, vklToggle, currentVklMode, renderMetricNoteRows('VKL', metrics, currentVklMode));
			}

			function getNoteModalMetrics(payload) {
				if (!payload || !Array.isArray(payload.table)) {
					return [];
				}

				const seen = {};
				return payload.table.reduce(function(result, section) {
					const metric = String(section && section.metric ? section.metric : '').trim();
					const metricKey = normalizeMetricName(metric);
					if (!metric || !metricKey || seen[metricKey]) {
						return result;
					}
					seen[metricKey] = true;
					result.push(metric);
					return result;
				}, []);
			}

			function ensureNoteModalNotesLoaded(payload) {
				if (!payload) {
					return;
				}
				ensureMetricNotesLoaded(GLOBAL_SCOPE_NOTE_KEY);
				getNoteModalMetrics(payload).forEach(function(metric) {
					ensureMetricNotesLoaded(metric);
				});
			}

			function resolveVklNoteScopeMode(payload, preferredMode) {
				if (!payload || !payload.user || payload.user.role !== 'VKL' || !payload.scope || payload.scope.type !== 'STORE') {
					return 'scope';
				}
				return preferredMode === 'vkl' ? 'vkl' : 'store';
			}

			function getCurrentVklNoteTargetForRequest() {
				return resolveVklNoteScopeMode(state.dashboard, state.vklNoteScopeMode);
			}

			function buildPendingNoteKey(metric, role, noteScopeMode) {
				const normalizedMetric = String(metric || '').trim();
				const normalizedRole = String(role || '').trim().toUpperCase();
				const normalizedMode = normalizedRole === 'VKL' ? String(noteScopeMode || getCurrentVklNoteTargetForRequest() || 'scope').trim().toLowerCase() : 'scope';
				return [normalizedMetric, normalizedRole, normalizedMode].join('|');
			}

			function buildMetricNotesCacheKey(metric) {
				const scopeId = state.dashboard && state.dashboard.scope ? state.dashboard.scope.id : '';
				const metricKey = String(metric || '').trim() === GLOBAL_SCOPE_NOTE_KEY ? GLOBAL_SCOPE_NOTE_KEY : normalizeMetricName(metric);
				const vklMode = getCurrentVklNoteTargetForRequest();
				return String(scopeId || '') + '|' + metricKey + '|' + vklMode;
			}

			function getCachedMetricNotes(metric) {
				return state.metricNotesCache[buildMetricNotesCacheKey(metric)] || null;
			}

			function isMetricNotesLoading(metric) {
				return Boolean(state.metricNotesLoading[buildMetricNotesCacheKey(metric)]);
			}

			function ensureMetricNotesLoaded(metric) {
				if (!state.dashboard || !metric) {
					return;
				}

				const cacheKey = buildMetricNotesCacheKey(metric);
				if (state.metricNotesCache[cacheKey] || state.metricNotesLoading[cacheKey]) {
					return;
				}

				state.metricNotesLoading[cacheKey] = true;
				renderNoteModal();
				renderScopeNotesIndicator();
				const request = google.script.run
					.withSuccessHandler(function(notes) {
						state.metricNotesCache[cacheKey] = notes || { VOD: {}, VKL: {} };
						delete state.metricNotesLoading[cacheKey];
						renderScopeNotesIndicator();
						if (!document.getElementById('noteModalBackdrop').classList.contains('hidden')) {
							renderNoteModal();
						}
					})
					.withFailureHandler(function() {
						delete state.metricNotesLoading[cacheKey];
						renderScopeNotesIndicator();
						if (!document.getElementById('noteModalBackdrop').classList.contains('hidden')) {
							renderNoteModal();
						}
					});
				request.getScopeNotes(state.loginValue, state.dashboard.scope.id, getCurrentVklNoteTargetForRequest(), metric);
			}

			function renderScopeNotesIndicator() {
				const indicator = document.getElementById('scopeNotesIndicator');
				if (!indicator) {
					return;
				}

				const cachedNotes = getCachedMetricNotes(GLOBAL_SCOPE_NOTE_KEY);
				const currentUserRole = state.dashboard && state.dashboard.user ? state.dashboard.user.role : '';
				const pendingText = String(state.pendingNotes[buildPendingNoteKey(GLOBAL_SCOPE_NOTE_KEY, currentUserRole, getCurrentVklNoteTargetForRequest())] || '').trim();
				const hasNotes = Boolean(pendingText) || hasScopeNotes(cachedNotes);
				indicator.classList.toggle('is-active', hasNotes);
				indicator.title = hasNotes ? 'V poznĂˇmkach uĹľ je obsah od VKL alebo VOD.' : 'ZatiaÄľ bez spoloÄŤnĂ˝ch poznĂˇmok.';
			}

			function hasScopeNotes(notes) {
				if (!notes) {
					return false;
				}
				return Boolean((notes.VOD && String(notes.VOD.text || '').trim()) || (notes.VKL && String(notes.VKL.text || '').trim()));
			}

			function renderSingleNoteCard(role, metric, note, isEditable, placeholder, headerExtraHtml, noteScopeMode, bodyExtraHtml) {
				const userRole = state.dashboard ? state.dashboard.user.role : '';
				const pendingKey = buildPendingNoteKey(metric, role, noteScopeMode);
				const pendingValue = Object.prototype.hasOwnProperty.call(state.pendingNotes, pendingKey) && userRole === role
					? state.pendingNotes[pendingKey]
					: null;
				const textValue = pendingValue != null ? pendingValue : String(note.text || '');
				const meta = note.updatedAt
					? 'Naposledy upravil ' + escapeHtml(note.author || role) + ' â€˘ ' + escapeHtml(note.updatedAt)
					: 'ZatiaÄľ bez poznĂˇmky';

				return '<div class="note-card">'
					+ '<h4>PoznĂˇmka ' + escapeHtml(role) + '</h4>'
					+ (headerExtraHtml || '')
					+ '<div class="note-meta">' + meta + '</div>'
					+ (isEditable
						? '<textarea class="note-textarea" data-role="' + escapeHtml(role) + '" data-metric="' + escapeHtml(metric) + '" data-note-scope-mode="' + escapeHtml(noteScopeMode || 'scope') + '" placeholder="' + escapeHtml(placeholder) + '">' + escapeHtml(textValue) + '</textarea>'
						: '<div class="note-readonly">' + escapeHtml(textValue || 'Bez textu') + '</div>')
					+ (bodyExtraHtml || '')
					+ '</div>';
			}

			function renderMetricNoteRows(role, metrics, noteScopeMode) {
				if (!metrics.length) {
					return '';
				}

				const isEditable = state.dashboard && state.dashboard.user && state.dashboard.user.role === role;
				return '<div class="note-metric-list">'
					+ metrics.map(function(metric) {
						const metricNotes = getCachedMetricNotes(metric) || { VOD: {}, VKL: {} };
						const metricNote = metricNotes[role] || {};
						const pendingKey = buildPendingNoteKey(metric, role, noteScopeMode);
						const pendingValue = Object.prototype.hasOwnProperty.call(state.pendingNotes, pendingKey) && state.dashboard.user.role === role
							? state.pendingNotes[pendingKey]
							: null;
						const textValue = pendingValue != null ? pendingValue : String(metricNote.text || '');
						const isLoading = isMetricNotesLoading(metric);
						const meta = isLoading
							? 'NaÄŤĂ­tavam uloĹľenĂş poznĂˇmku k metrike.'
							: metricNote.updatedAt
							? 'Naposledy upravil ' + escapeHtml(metricNote.author || role) + ' â€˘ ' + escapeHtml(metricNote.updatedAt)
							: 'PripravenĂ˝ riadok pre poznĂˇmku k metrike.';
						const placeholder = 'DoplĹ struÄŤnĂş poznĂˇmku ku metrike ' + metric + '.';

						return '<label class="note-metric-row">'
							+ '<span class="note-metric-name">' + escapeHtml(metric) + '</span>'
							+ (isEditable
								? '<textarea class="note-textarea note-textarea--metric" data-role="' + escapeHtml(role) + '" data-metric="' + escapeHtml(metric) + '" data-note-scope-mode="' + escapeHtml(noteScopeMode || 'scope') + '" placeholder="' + escapeHtml(placeholder) + '">' + escapeHtml(textValue) + '</textarea>'
								: '<div class="note-readonly">' + escapeHtml(textValue || 'Bez textu') + '</div>')
							+ '<span class="note-metric-meta">' + meta + '</span>'
							+ '</label>';
					}).join('')
					+ '</div>';
			}

			function renderBreakdownBlock(section, months, visibleMonthEntries, workingDaysByMonth) {
				if (!section.breakdown || !section.breakdown.length) {
					return '';
				}

				function getBreakdownLabel(item) {
					return String(item.displayLabel || '').trim() || formatStoreDisplayLabel(item.storeId, item.storeName);
				}

				function renderBreakdownTable(items, firstColumnLabel, collapseAfter) {
					var pageSize = typeof collapseAfter === 'number' ? collapseAfter : 10;
					var totalItems = items.length;
					var hasMore = totalItems > pageSize;
					var focusedMonth = getFocusedMonthForCompactTables(months);
					function getFocusedMonthCellClass(month) {
						return month === focusedMonth ? 'metric-month-cell is-focused' : '';
					}
					function appendCellClass(html, className) {
						if (!className) {
							return html;
						}
						if (html.indexOf('<td class="') === 0) {
							return html.replace('<td class="', '<td class="' + className + ' ');
						}
						if (html.indexOf('<td ') === 0) {
							return html.replace('<td ', '<td class="' + className + '" ');
						}
						return html.replace('<td>', '<td class="' + className + '">');
					}
					var tableHead = '<div class="metric-table-scroll"><table class="breakdown-table"><thead><tr><th>' + escapeHtml(firstColumnLabel) + '</th><th>Obdobie</th>'
						+ visibleMonthEntries.map(function(entry) { return '<th class="metric-month-head' + (entry.month === focusedMonth ? ' is-focused' : '') + '">' + escapeHtml(formatMonthShort(entry.month)) + '</th>'; }).join('')
						+ '<th>SumĂˇr roka</th></tr></thead><tbody>';

					function renderBreakdownItem(item, itemIndex) {
						var itemPlanRow = item.rows.find(function(row) { return row.type === 'plan'; }) || { values: [], total: 0 };
						var itemSection = { metric: section.metric, format: section.format, rows: item.rows };
						var displayRows = filterVisibleDisplayRows(buildDisplayRowsForSection(itemSection, months, workingDaysByMonth));
						if (!displayRows.length) {
							return '';
						}
						var hiddenClass = hasMore && itemIndex >= pageSize ? ' class="breakdown-hidden-row"' : '';
						var rowsHtml = displayRows.map(function(row, index) {
							return '<tr data-row-type="' + row.type + '"' + hiddenClass + '>'
								+ (index === 0 ? '<td class="store-name-cell" rowspan="' + displayRows.length + '">' + escapeHtml(getBreakdownLabel(item)) + '</td>' : '')
								+ '<td>' + escapeHtml(getDisplayRowLabel(row)) + '</td>'
								+ visibleMonthEntries.map(function(entry) {
									var value = row.values[entry.index];
									var fmt = row.displayFormat || section.format;
									var focusedCellClass = getFocusedMonthCellClass(entry.month);
									switch (row.type) {
										case 'structure-mix':
											return appendCellClass(renderStructureMixCell(value, entry.month, false, getWorkingDaysForStructureMonth(entry.month, entry.index, workingDaysByMonth)), focusedCellClass);
										case 'structure-days':
											return '<td class="' + focusedCellClass + '">' + formatMetric(value, row.displayFormat || 'fte') + '</td>';
										case 'static-plan':
										case 'workforce-total':
										case 'structure-hours-derived':
										case 'structure-hours-plan':
											return '<td class="' + focusedCellClass + '">' + formatMetric(value, fmt) + '</td>';
										case 'structure-hours-real':
											return value == null ? '<td class="' + focusedCellClass + ' ist-zero-fill" title="IST eĹˇte nie je k dispozĂ­cii">' + formatMetric(0, row.displayFormat || 'hours') + '</td>' : '<td class="' + focusedCellClass + '">' + formatMetric(value, row.displayFormat || 'hours') + '</td>';
										case 'delta':
											return '<td class="' + focusedCellClass + ' ' + getDeltaCellClass(value) + '"><span class="delta-value">' + formatSignedMetric(value, section.format) + '</span></td>';
										case 'forecast':
											return appendCellClass(renderForecastTableCell(value, itemPlanRow.values[entry.index], section.format), focusedCellClass);
										case 'real':
											return appendCellClass(renderRealTableCell(itemSection, row, value, entry.index), focusedCellClass);
										default:
											return '<td class="' + focusedCellClass + '">' + formatMetric(value, section.format) + '</td>';
									}
								}).join('')
								+ renderMetricYearTotalCell(row, section.format, itemPlanRow.total, itemSection)
								+ '</tr>';
						}).join('');

						if (Array.isArray(item.breakdown) && item.breakdown.length) {
							rowsHtml += '<tr' + hiddenClass + '><td colspan="' + (visibleMonthEntries.length + 3) + '"><details class="breakdown-panel breakdown-panel--nested"><summary class="breakdown-toggle">RozbaliĹĄ po filiĂˇlkach (' + Number(item.breakdown.length || 0) + ')</summary><div class="breakdown-content">'
								+ renderBreakdownTable(item.breakdown, 'FiliĂˇlka', 8)
								+ '</div></details></td></tr>';
						}

						return rowsHtml;
					}

					var breakdownRows = items.map(renderBreakdownItem).join('');
					var showMoreBtn = hasMore
						? '<div class="breakdown-show-more"><button class="breakdown-show-more-btn" type="button">ZobraziĹĄ vĹˇetky poloĹľky (' + totalItems + ')</button></div>'
						: '';
					return tableHead + breakdownRows + '</tbody></table></div>' + showMoreBtn;
				}

				var firstColumnLabel = section.breakdown.some(function(item) { return Array.isArray(item.breakdown) && item.breakdown.length; }) ? 'VKL' : 'FiliĂˇlka';
				return '<details class="breakdown-panel"><summary class="breakdown-toggle">RozbaliĹĄ po filiĂˇlkach (' + Number(section.breakdown.length || 0) + ')</summary><div class="breakdown-content">'
					+ renderBreakdownTable(section.breakdown, firstColumnLabel, 10) + '</div></details>';
			}

			function getDisplayedRealValue(section, realRow, index) {
				if (!realRow || index < 0) {
					return 0;
				}

				if (shouldUsePlanFallbackForMetric(section && section.metric) && !hasActualRealValue(realRow, index)) {
					return getPlanValueForIndex(section, index);
				}

				const rawValue = Number(realRow.values && realRow.values[index] || 0);
				if (hasActualRealValue(realRow, index) || Math.abs(rawValue) > 0.0001) {
					return rawValue;
				}

				return getPlanValueForIndex(section, index);
			}

			function getPlanValueForIndex(section, index) {
				if (!section || !Array.isArray(section.rows) || index < 0) {
					return 0;
				}

				const planRow = section.rows.find(function(row) { return row.type === 'plan'; }) || null;
				return Number(planRow && planRow.values ? planRow.values[index] : 0);
			}

			function shouldUsePlanFallbackForMetric(metric) {
				const fallbackMetrics = [
					'DlhodobĂˇ neprĂ­tomnosĹĄ (33+ dnĂ­) (b)',
					'ExternĂˇ pracovnĂˇ agentĂşra (+) Reinigung',
					'ExternĂˇ pracovnĂˇ agentĂşra (+) WareneinrĂ¤umung',
					'PN KrĂˇtkodobĂ©',
					'Odmena za dohodu',
					'Odmena za pr.prĂˇcu Ĺľiak (+) 50%',
					'NadÄŤasy (+)',
					'Saldo DF (+)',
					'Saldo DF (-)',
					'Dovolenka (-)',
					'FiMa/Prestavba/DodatoÄŤnĂ© prĂˇce/NEO',
					'Hodiny netto',
					'Obrat GJ2026',
					'ÄŚistĂ˝ vĂ˝kon'
				];

				return fallbackMetrics.some(function(fallbackMetric) {
					return normalizeMetricName(fallbackMetric) === normalizeMetricName(metric);
				});
			}

			function isFallbackRealDisplay(section, realRow, index) {
				if (!realRow || index < 0) {
					return false;
				}

				const hasActual = hasActualRealValue(realRow, index);
				if (!shouldUsePlanFallbackForMetric(section && section.metric) || hasActual) {
					return false;
				}

				const displayedValue = getDisplayedRealValue(section, realRow, index);
				return Math.abs(displayedValue) > 0.0001;
			}

			function hasFallbackRealDisplay(section, realRow) {
				if (!realRow || !Array.isArray(realRow.values)) {
					return false;
				}

				return realRow.values.some(function(value, index) {
					return isFallbackRealDisplay(section, realRow, index);
				});
			}

			function renderRealTableCell(section, row, value, index) {
				const displayedValue = getDisplayedRealValue(section, row, index);
				const isPlanFallback = isFallbackRealDisplay(section, row, index);
				const className = isPlanFallback ? ' class="ist-plan-fill"' : '';
				const title = isPlanFallback ? ' title="IST je zatiaÄľ doplnenĂ© z plĂˇnu"' : '';
				return '<td' + className + title + '>' + formatMetric(displayedValue, section.format) + '</td>';
			}

			function getMetricSnapshot(payload, metric, month) {
				return buildDashboardMetricSnapshot(payload, metric, {
					month: month,
					months: payload.months || [],
				});
			}

			function formatHeroCardValue(card) {
				return card && card.valueSigned
					? formatSignedMetric(card.value, card.format)
					: formatMetric(card.value, card.format);
			}

			function getDisplayPlanLabel() {
				return 'RoÄŤnĂ˝ PlĂˇn';
			}

			function getMetricDisplayLabel(metric) {
				const rawMetric = String(metric || '').trim();
				const normalizedMetric = normalizeMetricName(rawMetric);
				const replacements = {
					'dlhodoba nepritomnost (33+ dni) (b)': 'DlhodobĂˇ neprĂ­tomnosĹĄ',
					'externa pracovna agentura (+) reinigung': 'ExternĂˇ agentĂşra',
					'odmena za pr.pracu ziak (+) 50%': 'Odmena za pr.prĂˇcu Ĺľiak',
					'fima/prestavba/dodatocne prace/neo': 'FiMa/Prestavba/OstatnĂ©'
				};

				return Object.prototype.hasOwnProperty.call(replacements, normalizedMetric)
					? replacements[normalizedMetric]
					: rawMetric;
			}

			function getDisplayForecastLabel() {
				return 'Ăšprava VOD';
			}

			function getDisplayRowLabel(row) {
				if (row && row.type === 'plan') {
					return getDisplayPlanLabel();
				}
				if (row && row.type === 'forecast') {
					return getDisplayForecastLabel();
				}
				if (row && row.type === 'delta') {
					return 'Î” Delta vs IST';
				}
				if (row && row.type === 'recommendation') {
					return 'Doporucenie Vzorca';
				}
				return String(row && row.label || '');
			}

			function getPeriodLabel(selectedMonth) {
				return selectedMonth === '__YEAR__' ? 'SumĂˇr roka' : 'Mesiac ' + formatMonthShort(selectedMonth);
			}

			function hasForecastAdjustmentPair(section) {
				return Boolean(
					section
					&& Array.isArray(section.rows)
					&& section.rows.find(function(row) { return row.type === 'adjustment'; })
					&& section.rows.find(function(row) { return row.type === 'forecast'; })
				);
			}

			function usesUnifiedForecastInput(section) {
				const normalizedMetric = normalizeMetricName(section && section.metric);
				return hasForecastAdjustmentPair(section)
					&& normalizedMetric !== normalizeMetricName('ÄŚistĂ˝ vĂ˝kon')
					&& normalizedMetric !== normalizeMetricName('Hodiny netto')
					&& normalizedMetric !== normalizeMetricName('Hodiny Brutto GJ2026');
			}

			function getRoundModeForFormat(format) {
				return format === 'number' || format === 'fte' ? 'decimal' : 'integer';
			}

			function getMetricDeltaValue(format, planValue, actualValue, hasActual, forecastValue) {
				return normalizeStoredMetricValue(
					Number(forecastValue || 0) - Number(hasActual ? actualValue : planValue || 0),
					format
				);
			}

			function getMetricDeltaValues(section, planRow, realRow, forecastRow) {
				const valueCount = Math.max(
					Array.isArray(planRow && planRow.values) ? planRow.values.length : 0,
					Array.isArray(realRow && realRow.values) ? realRow.values.length : 0,
					Array.isArray(forecastRow && forecastRow.values) ? forecastRow.values.length : 0
				);

				return Array.from({ length: valueCount }, function(value, index) {
					const hasActual = hasActualRealValue(realRow, index);
					return getMetricDeltaValue(
						section.format,
						Number(planRow && planRow.values ? planRow.values[index] : 0),
						getActualRealValue(realRow, index),
						hasActual,
						Number(forecastRow && forecastRow.values ? forecastRow.values[index] : 0)
					);
				});
			}

			function summarizeDeltaRowTotal(section, values) {
				const deltaValues = Array.isArray(values) ? values : [];
				const rowSet = arguments.length > 2 ? arguments[2] : null;
				if (normalizeMetricName(section && section.metric) === normalizeMetricName('ÄŚistĂ˝ vĂ˝kon') && Array.isArray(rowSet)) {
					const planRow = rowSet.find(function(row) { return row.type === 'plan'; }) || null;
					const realRow = rowSet.find(function(row) { return row.type === 'real'; }) || null;
					const forecastRow = rowSet.find(function(row) { return row.type === 'forecast'; }) || null;
					const hasRealTotal = realRow
						? ((Array.isArray(realRow.hasRealFlags) && realRow.hasRealFlags.some(function(flag) { return Boolean(flag); }))
							|| (Array.isArray(realRow.actualValues) && realRow.actualValues.some(function(value) { return Math.abs(Number(value || 0)) > 0.0001; })))
						: false;

					if (planRow && forecastRow) {
						return getMetricDeltaValue(
							section && section.format || 'number',
							Number(planRow.total || 0),
							Number(realRow && realRow.total || 0),
							hasRealTotal,
							Number(forecastRow.total || 0)
						);
					}

					return normalizeStoredMetricValue(averageArray(deltaValues), section && section.format || 'number');
				}

				return normalizeStoredMetricValue(sumArray(deltaValues), section && section.format || 'number');
			}

			function applyComputedDeltaRows(rows, section) {
				if (!rows || !rows.length) {
					return;
				}

				const planRow = rows.find(function(row) { return row.type === 'plan'; }) || null;
				const realRow = rows.find(function(row) { return row.type === 'real'; }) || null;
				const forecastRow = rows.find(function(row) { return row.type === 'forecast'; }) || null;
				const deltaRow = rows.find(function(row) { return row.type === 'delta'; }) || null;

				if (!planRow || !forecastRow || !deltaRow) {
					return;
				}

				deltaRow.values = getMetricDeltaValues(section, planRow, realRow, forecastRow);
				deltaRow.total = summarizeDeltaRowTotal(section, deltaRow.values, rows);
			}

			function buildDisplayRowsForSection(section, months, workingDaysByMonth, context) {
				let rows = Array.isArray(section && section.rows) ? section.rows.slice() : [];
				if (hasForecastAdjustmentPair(section)) {
					rows = rows.filter(function(row) {
						return row.type !== 'adjustment';
					});
				}
				applyComputedYearTotals(rows, section, context || null);
				applyComputedDeltaRows(rows, section);
				if (normalizeMetricName(section && section.metric) !== normalizeMetricName('Ĺ truktĂşra hodĂ­n')) {
					return insertRecommendationRowIfNeeded(rows, section, months, context || null);
				}

				const planIndex = rows.findIndex(function(row) {
					return row.type === 'plan';
				});
				if (planIndex === -1) {
					return insertRecommendationRowIfNeeded(rows, section, months, context || null);
				}

				rows.splice(planIndex + 1, 0, buildStructureDaysRow(months, rows[planIndex], workingDaysByMonth));
				return insertRecommendationRowIfNeeded(rows, section, months, context || null);
			}

			function applyComputedYearTotals(rows, section, context) {
				if (!rows || !rows.length || !context || !Array.isArray(context.table)) {
					return;
				}

				if (normalizeMetricName(section && section.metric) !== normalizeMetricName('ÄŚistĂ˝ vĂ˝kon')) {
					return;
				}

				const turnoverSection = findSectionByMetric({ table: context.table }, 'Obrat GJ2026');
				const netSection = findSectionByMetric({ table: context.table }, 'Hodiny netto');
				if (!turnoverSection || !netSection) {
					return;
				}

				const turnoverPlanRow = turnoverSection.rows.find(function(row) { return row.type === 'plan'; }) || { total: 0 };
				const turnoverRealRow = turnoverSection.rows.find(function(row) { return row.type === 'real'; }) || { total: 0 };
				const turnoverForecastRow = turnoverSection.rows.find(function(row) { return row.type === 'forecast'; }) || { total: 0 };
				const netPlanRow = netSection.rows.find(function(row) { return row.type === 'plan'; }) || { total: 0 };
				const netRealRow = netSection.rows.find(function(row) { return row.type === 'real'; }) || { total: 0 };
				const netForecastRow = netSection.rows.find(function(row) { return row.type === 'forecast'; }) || { total: 0 };
				const rowByType = function(type) {
					return rows.find(function(row) { return row.type === type; }) || null;
				};
				const performancePlanRow = rowByType('plan');
				const performanceRealRow = rowByType('real');
				const performanceForecastRow = rowByType('forecast');
				const performanceDeltaRow = rowByType('delta');
				const monthCount = Math.max(
					Array.isArray(turnoverPlanRow.values) ? turnoverPlanRow.values.length : 0,
					Array.isArray(netPlanRow.values) ? netPlanRow.values.length : 0,
					Array.isArray(turnoverForecastRow.values) ? turnoverForecastRow.values.length : 0,
					Array.isArray(netForecastRow.values) ? netForecastRow.values.length : 0
				);
				const toPerformanceValue = function(turnoverValue, hourValue) {
					return normalizeStoredMetricValue(Number(hourValue || 0) ? Number(turnoverValue || 0) / Number(hourValue || 0) : 0, 'number');
				};
				const monthIndexes = Array.from({ length: monthCount }, function(value, index) {
					return index;
				});

				if (performancePlanRow) {
					performancePlanRow.values = monthIndexes.map(function(index) {
						return toPerformanceValue(
							Number(turnoverPlanRow.values && turnoverPlanRow.values[index] || 0),
							Number(netPlanRow.values && netPlanRow.values[index] || 0)
						);
					});
				}

				if (performanceRealRow) {
					performanceRealRow.values = monthIndexes.map(function(index) {
						return toPerformanceValue(
							Number(turnoverRealRow.values && turnoverRealRow.values[index] || 0),
							Number(netRealRow.values && netRealRow.values[index] || 0)
						);
					});
					performanceRealRow.hasRealFlags = monthIndexes.map(function(index) {
						return hasActualRealValue(turnoverRealRow, index) && hasActualRealValue(netRealRow, index);
					});
					performanceRealRow.actualValues = monthIndexes.map(function(index) {
						if (!performanceRealRow.hasRealFlags[index]) {
							return 0;
						}
						return toPerformanceValue(getActualRealValue(turnoverRealRow, index), getActualRealValue(netRealRow, index));
					});
				}

				if (performanceForecastRow) {
					performanceForecastRow.values = monthIndexes.map(function(index) {
						const hasActualTurnover = hasActualRealValue(turnoverRealRow, index);
						const hasActualHours = hasActualRealValue(netRealRow, index);
						if (hasActualTurnover && hasActualHours) {
							return toPerformanceValue(getActualRealValue(turnoverRealRow, index), getActualRealValue(netRealRow, index));
						}
						return toPerformanceValue(
							Number(turnoverForecastRow.values && turnoverForecastRow.values[index] || 0),
							Number(netForecastRow.values && netForecastRow.values[index] || 0)
						);
					});
				}

				if (performanceDeltaRow && performancePlanRow && performanceForecastRow) {
					performanceDeltaRow.values = monthIndexes.map(function(index) {
						const hasActualPerformance = performanceRealRow && Array.isArray(performanceRealRow.hasRealFlags)
							? Boolean(performanceRealRow.hasRealFlags[index])
							: false;
						return getMetricDeltaValue(
							'number',
							Number(performancePlanRow.values[index] || 0),
							performanceRealRow && Array.isArray(performanceRealRow.actualValues) ? Number(performanceRealRow.actualValues[index] || 0) : 0,
							hasActualPerformance,
							Number(performanceForecastRow.values[index] || 0)
						);
					});
				}

				const planTotal = normalizeStoredMetricValue(sumArray(netPlanRow.values) ? sumArray(turnoverPlanRow.values) / sumArray(netPlanRow.values) : 0, 'number');
				const realTotal = normalizeStoredMetricValue(sumArray(netRealRow.values) ? sumArray(turnoverRealRow.values) / sumArray(netRealRow.values) : 0, 'number');
				const forecastTotal = normalizeStoredMetricValue(sumArray(netForecastRow.values) ? sumArray(turnoverForecastRow.values) / sumArray(netForecastRow.values) : 0, 'number');

				rows.forEach(function(row) {
					if (row.type === 'plan') {
						row.total = planTotal;
						return;
					}
					if (row.type === 'real') {
						row.total = realTotal;
						return;
					}
					if (row.type === 'forecast') {
						row.total = forecastTotal;
						return;
					}
					if (row.type === 'delta') {
						row.total = summarizeDeltaRowTotal(section, row.values || [], rows);
					}
				});
			}

			function insertRecommendationRowIfNeeded(rows, section, months, context) {
				const recommendationRow = buildRecommendationDisplayRow(section, months, context);
				if (!recommendationRow) {
					return rows;
				}

				const deltaIndex = rows.findIndex(function(row) {
					return row.type === 'delta';
				});
				const insertIndex = deltaIndex > -1 ? deltaIndex + 1 : rows.length;
				rows.splice(insertIndex, 0, recommendationRow);
				return rows;
			}

			function buildRecommendationDisplayRow(section, months, context) {
				if (!context || context.scopeType !== 'STORE') {
					return null;
				}

				const metricName = normalizeMetricName(section && section.metric);
				if (metricName === normalizeMetricName('Dovolenka (-)')) {
					return buildVacationPlanningGuideRow(section, months);
				}

				if (metricName === normalizeMetricName('Obrat GJ2026') || metricName === normalizeMetricName('Hodiny netto')) {
					const recommendation = computeRecommendationDistribution(section, months);
					if (!recommendation) {
						return null;
					}

					return {
						type: 'recommendation',
						label: 'Doporucenie Vzorca',
						values: recommendation.values,
						total: recommendation.total,
					};
				}

				if (metricName === normalizeMetricName('ÄŚistĂ˝ vĂ˝kon')) {
					return buildPerformanceRecommendationRow(context, months);
				}

				return null;
			}

			function buildVacationPlanningGuideRow(section, months) {
				if (!section || !Array.isArray(section.rows) || !Array.isArray(months) || !months.length) {
					return null;
				}

				const planRow = section.rows.find(function(row) { return row.type === 'plan'; }) || null;
				const forecastRow = section.rows.find(function(row) { return row.type === 'forecast'; }) || planRow;
				const realRow = section.rows.find(function(row) { return row.type === 'real'; }) || null;
				const adjustmentRow = section.rows.find(function(row) { return row.type === 'adjustment'; }) || null;
				if (!planRow) {
					return null;
				}

				const distributionProfile = {
					marec: 7,
					april: 6,
					'aprĂ­l': 6,
					maj: 10,
					jun: 10,
					'jĂşn': 10,
					jul: 10,
					'jĂşl': 10,
					august: 16,
					september: 7,
					oktober: 8,
					'oktĂłber': 8,
					november: 7,
					december: 0,
					januar: 7,
					'januĂˇr': 7,
					februar: 6,
					'februĂˇr': 6,
				};

				const monthWeights = months.map(function(month) {
					const parts = String(month || '').trim().split(/\s+/);
					const monthName = normalizeMetricName(parts[0] || '');
					return Number(distributionProfile[monthName] || 0);
				});
				if (sumArray(monthWeights) <= 0) {
					return null;
				}

				const annualTarget = Math.max(0, Number(forecastRow && forecastRow.total || planRow.total || 0));
				const values = months.map(function() { return 0; });
				const openIndexes = [];
				let lockedTotal = 0;

				months.forEach(function(month, index) {
					const hasActual = hasActualRealValue(realRow, index);
					const isClosed = Boolean(adjustmentRow && adjustmentRow.closed && adjustmentRow.closed[index]);
					if (hasActual) {
						const actualValue = Number(getActualRealValue(realRow, index) || 0);
						values[index] = normalizeStoredMetricValue(actualValue, section.format || 'number');
						lockedTotal += actualValue;
						return;
					}

					if (isClosed) {
						const lockedForecastValue = Number(forecastRow && forecastRow.values ? forecastRow.values[index] : 0);
						values[index] = normalizeStoredMetricValue(lockedForecastValue, section.format || 'number');
						lockedTotal += lockedForecastValue;
						return;
					}

					openIndexes.push(index);
				});

				const remainingTarget = Math.max(0, annualTarget - lockedTotal);
				const openWeights = openIndexes.map(function(index) {
					return Number(monthWeights[index] || 0);
				});
				const distributedValues = distributeWeightedValue(
					remainingTarget,
					sumArray(openWeights) > 0 ? openWeights : openIndexes.map(function() { return 1; }),
					section.format
				);

				openIndexes.forEach(function(monthIndex, openIndex) {
					values[monthIndex] = distributedValues[openIndex];
				});

				return {
					type: 'vacation-guide',
					label: 'OdporĂşÄŤanĂ© ÄŤerpanie',
					values: values,
					total: normalizeStoredMetricValue(sumArray(values), section.format || 'number'),
				};
			}

			function buildPerformanceRecommendationRow(context, months) {
				const turnoverSection = findSectionByMetric({ table: context.table }, 'Obrat GJ2026');
				const netSection = findSectionByMetric({ table: context.table }, 'Hodiny netto');
				if (!turnoverSection || !netSection) {
					return null;
				}

				const turnoverRecommendation = computeRecommendationDistribution(turnoverSection, months);
				const netRecommendation = computeRecommendationDistribution(netSection, months);
				if (!turnoverRecommendation || !netRecommendation) {
					return null;
				}

				const turnoverForecastRow = turnoverSection.rows.find(function(row) { return row.type === 'forecast'; }) || { values: [] };
				const netForecastRow = netSection.rows.find(function(row) { return row.type === 'forecast'; }) || { values: [] };
				const values = months.map(function(month, index) {
					const projectedTurnover = Number(turnoverForecastRow.values[index] || 0) + Number(turnoverRecommendation.values[index] || 0);
					const projectedHours = Number(netForecastRow.values[index] || 0) + Number(netRecommendation.values[index] || 0);
					return normalizeStoredMetricValue(projectedHours ? projectedTurnover / projectedHours : 0, 'number');
				});
				const projectedTurnoverTotal = Number(turnoverForecastRow.total || 0) + Number(turnoverRecommendation.total || 0);
				const projectedHoursTotal = Number(netForecastRow.total || 0) + Number(netRecommendation.total || 0);

				return {
					type: 'recommendation-result',
					label: 'PredpokladanĂ˝ vĂ˝sledok',
					values: values,
					total: normalizeStoredMetricValue(projectedHoursTotal ? projectedTurnoverTotal / projectedHoursTotal : 0, 'number'),
				};
			}

			function computeRecommendationDistribution(section, months) {
				if (!section || !Array.isArray(section.rows)) {
					return null;
				}

				const planRow = section.rows.find(function(row) { return row.type === 'plan'; });
				const forecastRow = section.rows.find(function(row) { return row.type === 'forecast'; });
				if (!planRow || !forecastRow) {
					return null;
				}

				const openIndexes = getRecommendationOpenIndexes(section, months);
				const values = months.map(function() { return 0; });
				if (!openIndexes.length) {
					return {
						values: values,
						total: 0,
					};
				}

				const gapToPlan = Number(planRow.total || 0) - Number(forecastRow.total || 0);
				const weights = getRecommendationWeights(planRow.values, forecastRow.values, openIndexes);
				const distributedValues = distributeWeightedValue(gapToPlan, weights, section.format);

				openIndexes.forEach(function(monthIndex, openIndex) {
					values[monthIndex] = distributedValues[openIndex];
				});

				return {
					values: values,
					total: normalizeStoredMetricValue(sumArray(values), section.format),
				};
			}

			function getRecommendationOpenIndexes(section, months) {
				const realRow = section.rows.find(function(row) { return row.type === 'real'; }) || null;
				const realStates = months.map(function(month, index) {
					return hasActualRealValue(realRow, index);
				});
				const firstOpenIndex = realStates.findIndex(function(hasReal) {
					return !hasReal;
				});

				if (firstOpenIndex === -1) {
					return [];
				}

				return realStates.reduce(function(result, hasReal, index) {
					if (index >= firstOpenIndex && !hasReal) {
						result.push(index);
					}
					return result;
				}, []);
			}

			function getRecommendationWeights(planValues, forecastValues, openIndexes) {
				const planWeights = openIndexes.map(function(index) {
					return Math.max(0, Number(planValues && planValues[index] || 0));
				});
				if (sumArray(planWeights) > 0) {
					return planWeights;
				}

				const forecastWeights = openIndexes.map(function(index) {
					return Math.max(0, Number(forecastValues && forecastValues[index] || 0));
				});
				if (sumArray(forecastWeights) > 0) {
					return forecastWeights;
				}

				return openIndexes.map(function() {
					return 1;
				});
			}

			function distributeWeightedValue(totalValue, weights, format) {
				const safeWeights = Array.isArray(weights) ? weights.slice() : [];
				if (!safeWeights.length) {
					return [];
				}

				const totalWeight = sumArray(safeWeights);
				const precision = format === 'number' || format === 'fte' ? 10 : 1;
				const scaledTotal = Math.round(Number(totalValue || 0) * precision);
				let cumulativeWeight = 0;
				let allocated = 0;

				return safeWeights.map(function(weight, index) {
					cumulativeWeight += Number(weight || 0);
					if (index === safeWeights.length - 1) {
						return normalizeStoredMetricValue((scaledTotal - allocated) / precision, format);
					}

					const targetAllocated = totalWeight
						? Math.round((scaledTotal * cumulativeWeight) / totalWeight)
						: 0;
					const value = (targetAllocated - allocated) / precision;
					allocated = targetAllocated;
					return normalizeStoredMetricValue(value, format);
				});
			}

			function normalizeStoredMetricValue(value, format) {
				if (format === 'number' || format === 'fte') {
					return Math.round(Number(value || 0) * 10) / 10;
				}
				return Math.round(Number(value || 0));
			}

			function buildStructureDaysRow(months, planRow, workingDaysByMonth) {
				const values = months.map(function(month, index) {
					const workingDays = getWorkingDaysForStructureMonth(month, index, workingDaysByMonth);
					const denominator = workingDays * 7.75;
					return denominator ? Number(planRow.values[index] || 0) / denominator : 0;
				});
				const totalWorkingDays = months.reduce(function(sum, month, index) {
					return sum + getWorkingDaysForStructureMonth(month, index, workingDaysByMonth);
				}, 0);
				const totalDenominator = totalWorkingDays * 7.75;
				const total = totalDenominator ? Number(planRow.total || 0) / totalDenominator : 0;

				return {
					type: 'structure-days',
					label: 'Ĺ truktĂşra / ((dni + sviatky) * 7,75)',
					values: values,
					total: total,
					displayFormat: 'fte',
				};
			}

			function resolveWorkingDaysForStructure(tableSections, months) {
				const workingDaysSection = Array.isArray(tableSections) ? tableSections.find(function(section) {
					return normalizeMetricName(section && section.metric) === normalizeMetricName('PracovnĂ© dni zamestnancov');
				}) : null;
				const holidaySection = Array.isArray(tableSections) ? tableSections.find(function(section) {
					return normalizeMetricName(section && section.metric) === normalizeMetricName('Sviatok zatvorenĂ©');
				}) : null;
				const planRow = workingDaysSection && Array.isArray(workingDaysSection.rows)
					? workingDaysSection.rows.find(function(row) { return row.type === 'plan'; })
					: null;
				const holidayRow = holidaySection && Array.isArray(holidaySection.rows)
					? holidaySection.rows.find(function(row) { return row.type === 'plan'; })
					: null;

				return months.map(function(month, index) {
					const workingDays = Number(planRow && planRow.values ? planRow.values[index] : 0);
					const closedHolidayDays = Number(holidayRow && holidayRow.values ? holidayRow.values[index] : 0);
					const safeWorkingDays = workingDays > 0 && workingDays <= 31 ? workingDays : 0;
					const safeClosedHolidayDays = closedHolidayDays >= 0 && closedHolidayDays <= 31 ? closedHolidayDays : 0;
					if (safeWorkingDays > 0 || safeClosedHolidayDays > 0) {
						return safeWorkingDays + safeClosedHolidayDays;
					}
					return null;
				});
			}

			function getWorkingDaysForStructureMonth(monthLabel, monthIndex, workingDaysByMonth) {
				const scopedValue = Array.isArray(workingDaysByMonth) ? Number(workingDaysByMonth[monthIndex]) : 0;
				if (scopedValue > 0) {
					return scopedValue;
				}

				const normalizedMonth = normalizeMetricName(monthLabel);
				const mapping = {
					'marec 2026': 22,
					'april 2026': 21,
					'maj 2026': 21,
					'jun 2026': 22,
					'jul 2026': 23,
					'august 2026': 21,
					'september 2026': 22,
					'oktober 2026': 22,
					'november 2026': 21,
					'december 2026': 21,
					'januar 2027': 20,
					'februar 2027': 20,
				};

				if (Object.prototype.hasOwnProperty.call(mapping, normalizedMonth)) {
					const holidayMapping = {
						'marec 2026': 0,
						'april 2026': 1,
						'maj 2026': 0,
						'jun 2026': 0,
						'jul 2026': 0,
						'august 2026': 0,
						'september 2026': 0,
						'oktober 2026': 0,
						'november 2026': 0,
						'december 2026': 2,
						'januar 2027': 1,
						'februar 2027': 0,
					};
					return mapping[normalizedMonth] + Number(holidayMapping[normalizedMonth] || 0);
				}

				const fallbackByIndex = [22, 21, 21, 22, 23, 21, 22, 22, 21, 21, 20, 20];
				const holidayFallbackByIndex = [0, 1, 0, 0, 0, 0, 0, 0, 0, 2, 1, 0];
				return (fallbackByIndex[monthIndex] || 0) + (holidayFallbackByIndex[monthIndex] || 0);
			}

			function renderStructureMixCell(value, month, editable, workingDays) {
				const mix = value && value.bands ? value : { bands: [], totalAdjustment: 0 };
				const baselineDailyHours = mix.bands.reduce(function(sum, band) {
					return sum + (Number(band.count || 0) * Number(band.hoursWeight || 0));
				}, 0);
				const inputs = mix.bands.map(function(band) {
					const comparison = buildStructureMixComparisonMarkup(Number(band.count || 0), band);
					return '<label class="structure-mix-item">'
						+ '<span>' + escapeHtml(formatStructureBandLabel(band)) + '</span>'
						+ '<input class="structure-mix-input" inputmode="numeric" type="number" min="0" step="1" data-mix-metric="' + escapeHtml(band.key) + '" data-month="' + escapeHtml(month) + '" data-fte-weight="' + Number(band.fteWeight || 0) + '" data-hours-weight="' + Number(band.hoursWeight || 0) + '" data-plan-count="' + Number(band.planCount || 0) + '" data-real-count="' + Number(band.realCount || 0) + '" data-real-available="' + (band.hasRealCount ? '1' : '0') + '" value="' + Number(band.count || 0) + '" ' + (editable ? '' : 'disabled') + '>'
						+ comparison
						+ '</label>';
				}).join('');

				return '<td class="structure-mix-cell" data-month="' + escapeHtml(month) + '" data-working-days="' + Number(workingDays || 0) + '" data-baseline-total-adjustment="' + Number(mix.totalAdjustment || 0) + '" data-baseline-daily-hours="' + baselineDailyHours + '"><div class="structure-mix-month">' + escapeHtml(formatMonthShort(month)) + '</div><div class="structure-mix-grid">' + inputs + '</div><div class="structure-mix-total">ÎŁ ' + formatMetric(mix.totalAdjustment || 0, 'fte') + '</div></td>';
			}

			function updateStructureDerivedAdjustments(cell, month) {
				if (!cell || !month) {
					return;
				}

				const inputs = Array.from(cell.querySelectorAll('.structure-mix-input'));
				const baselineFte = Number(cell.dataset.baselineTotalAdjustment || 0);
				const baselineDailyHours = Number(cell.dataset.baselineDailyHours || 0);
				const workingDays = Number(cell.dataset.workingDays || 0);
				const currentFte = inputs.reduce(function(sum, input) {
					return sum + (Number(input.value || 0) * Number(input.dataset.fteWeight || 0));
				}, 0);
				const currentDailyHours = inputs.reduce(function(sum, input) {
					return sum + (Number(input.value || 0) * Number(input.dataset.hoursWeight || 0));
				}, 0);
				const fteDelta = currentFte - baselineFte;
				const hoursDelta = (currentDailyHours - baselineDailyHours) * workingDays;

				if (!state.pendingAdjustments['Ĺ truktĂşra filiĂˇlky (plnĂ© ĂşvĂ¤zky)']) {
					state.pendingAdjustments['Ĺ truktĂşra filiĂˇlky (plnĂ© ĂşvĂ¤zky)'] = {};
				}
				state.pendingAdjustments['Ĺ truktĂşra filiĂˇlky (plnĂ© ĂşvĂ¤zky)'][month] = Math.round(fteDelta * 100) / 100;
			}

			function buildStructureMixComparisonMarkup(currentCount, band) {
				const compareMode = getStructureMixCompareMode();
				if (compareMode === 'none') {
					return '';
				}

				const chips = [];
				if (compareMode === 'plan' || compareMode === 'both') {
					chips.push(renderStructureCompareChip('PlĂˇn', currentCount - Number(band.planCount || 0), 'plan', true));
				}
				if (compareMode === 'ist' || compareMode === 'both') {
					chips.push(renderStructureCompareChip('IST', currentCount - Number(band.realCount || 0), 'ist', Boolean(band.hasRealCount)));
				}

				return '<div class="structure-mix-compare">' + chips.join('') + '</div>';
			}

			function renderStructureCompareChip(label, delta, variant, isAvailable) {
				if (!isAvailable) {
					return '<span class="structure-compare-chip structure-compare-chip--' + variant + ' is-empty" title="IST eĹˇte nie je k dispozĂ­cii">' + escapeHtml(label) + ' ' + formatSignedMetric(0, 'number') + '</span>';
				}
				const className = delta > 0 ? 'positive' : delta < 0 ? 'negative' : '';
				return '<span class="structure-compare-chip structure-compare-chip--' + variant + (className ? ' ' + className : '') + '">' + escapeHtml(label) + ' ' + formatSignedMetric(delta, 'number') + '</span>';
			}

			function formatStructureBandLabel(band) {
				const weight = Number(band && (band.hoursWeight !== undefined ? band.hoursWeight : band.weight));
				return weight.toFixed(2);
			}

			function renderMetricYearTotalCell(row, format, planTotal, sectionOrMetric) {
				const section = sectionOrMetric && typeof sectionOrMetric === 'object'
					? sectionOrMetric
					: { metric: sectionOrMetric, rows: [] };
				const metric = section.metric;
				if (row.type === 'structure-mix') {
					return '<td class="year-total-cell delta-neutral">model</td>';
				}

				if (row.type === 'structure-days') {
					return '<td class="year-total-cell">' + formatMetric(row.total, row.displayFormat || 'fte') + '</td>';
				}

				if (row.type === 'static-plan' || row.type === 'workforce-total' || row.type === 'structure-hours-derived' || row.type === 'structure-hours-plan') {
					return '<td class="year-total-cell">' + formatMetric(row.total, row.displayFormat || format) + '</td>';
				}

				if (row.type === 'structure-hours-real') {
					const hasAnyRealValue = Array.isArray(row.hasRealFlags) && row.hasRealFlags.some(function(flag) { return Boolean(flag); });
					if (!hasAnyRealValue) {
						return '<td class="year-total-cell ist-zero-fill" title="IST eĹˇte nie je k dispozĂ­cii">' + formatMetric(0, row.displayFormat || 'hours') + '</td>';
					}
					const isPartial = Array.isArray(row.hasRealFlags) && row.hasRealFlags.some(function(flag) { return !flag; });
					const title = isPartial ? ' title="IST sumĂˇr obsahuje len dostupnĂ© mesiace"' : '';
					return '<td class="year-total-cell"' + title + '>' + formatMetric(row.total, row.displayFormat || 'hours') + '</td>';
				}

				if (row.type === 'forecast') {
					return '<td class="year-total-cell ' + getForecastCellClass(row.total, planTotal) + '">' + formatMetric(row.total, format) + '</td>';
				}

				if (row.type === 'recommendation-result') {
					return '<td class="year-total-cell ' + getForecastCellClass(row.total, planTotal) + '">' + formatMetric(row.total, format) + '</td>';
				}

				if (row.type === 'real') {
					const displayedTotal = normalizeMetricName(metric) === normalizeMetricName('ÄŚistĂ˝ vĂ˝kon')
						? Number(row.total || 0)
						: (Array.isArray(row.values)
							? row.values.reduce(function(sum, value, index) {
								return sum + getDisplayedRealValue(section, row, index);
							}, 0)
							: Number(row.total || 0));
					const highlight = hasFallbackRealDisplay(section, row) ? ' ist-plan-fill' : '';
					const title = highlight ? ' title="IST sumĂˇr obsahuje mesiace doplnenĂ© z plĂˇnu"' : '';
					return '<td class="year-total-cell' + highlight + '"' + title + '>' + formatMetric(displayedTotal, format) + '</td>';
				}

				if (row.type === 'recommendation') {
					return '<td class="year-total-cell ' + getDeltaCellClass(row.total) + '">' + formatSignedMetric(row.total, format) + '</td>';
				}

				if (row.type === 'vacation-guide') {
					return '<td class="year-total-cell">' + formatMetric(row.total, format) + '</td>';
				}

				return '<td class="year-total-cell ' + (row.type === 'delta' ? getDeltaCellClass(row.total) : '') + '">' + (row.type === 'delta' ? formatSignedMetric(row.total, format) : formatMetric(row.total, format)) + '</td>';
			}

			function renderForecastTableCell(value, planValue, format) {
				return '<td class="' + getForecastCellClass(value, planValue) + '">' + formatMetric(value, format) + '</td>';
			}

			function getSuggestedMonth(months) {
				const now = new Date();
				const candidate = normalizeMetricName(now.toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' }));
				const match = months.find(function(month) {
					return normalizeMetricName(month) === candidate;
				});
				return match || months[0] || '';
			}

			function sumArray(values) {
				return (values || []).reduce(function(sum, value) {
					return sum + Number(value || 0);
				}, 0);
			}

			function averageArray(values) {
				if (!values || !values.length) {
					return 0;
				}
				return sumArray(values) / values.length;
			}

			function roundPreviewValue(value, mode) {
				if (mode === 'decimal') {
					return Math.round(Number(value || 0) * 10) / 10;
				}
				return Math.round(Number(value || 0));
			}

			function findSectionByMetric(payload, metric) {
				return (payload && payload.table || []).find(function(section) {
					return normalizeMetricName(section.metric) === normalizeMetricName(metric);
				}) || null;
			}

			function getPendingAdjustmentValue(metric, month) {
				if (!state.pendingAdjustments[metric]) {
					return null;
				}
				return Object.prototype.hasOwnProperty.call(state.pendingAdjustments[metric], month)
					? Number(state.pendingAdjustments[metric][month] || 0)
					: null;
			}

			function buildWeeklyAdjustmentKey(metric, month) {
				return normalizeMetricName(metric) + '|' + String(month || '');
			}

			function shouldIgnorePersistedWeeklyOverrides(metric, month) {
				const pendingMonthlyValue = getPendingAdjustmentValue(metric, month);
				const pendingWeeklyValues = getPendingWeeklyAdjustmentValues(metric, month);
				return pendingMonthlyValue != null && (!Array.isArray(pendingWeeklyValues) || !pendingWeeklyValues.length);
			}

			function getPendingWeeklyAdjustmentValues(metric, month) {
				const key = buildWeeklyAdjustmentKey(metric, month);
				return Array.isArray(state.pendingWeeklyAdjustments[key])
					? state.pendingWeeklyAdjustments[key].slice()
					: null;
			}

			function setPendingWeeklyAdjustmentValues(metric, month, values) {
				const key = buildWeeklyAdjustmentKey(metric, month);
				state.pendingWeeklyAdjustments[key] = (values || []).map(function(value) {
					return Number(value || 0);
				});
			}

			function removePendingWeeklyAdjustmentValues(metric, month) {
				delete state.pendingWeeklyAdjustments[buildWeeklyAdjustmentKey(metric, month)];
			}

			function invalidateWeeklyOverridesCache() {
				state.weeklyOverridesCache = {};
				state.weeklyOverridesLoading = {};
			}

			function applySavedWeeklyOverridesToCache(weeklyUpdates) {
				if (!state.dashboard || !state.dashboard.scope || !Array.isArray(weeklyUpdates) || !weeklyUpdates.length) {
					return;
				}

				const scopeId = state.dashboard.scope.id;
				const storeId = state.dashboard.scope.type === 'STORE' ? String(scopeId || '').trim() : '';
				const updatesByMonth = {};

				weeklyUpdates.forEach(function(update) {
					const month = String(update && update.month || '').trim();
					const metricKey = normalizeMetricName(update && update.metric);
					if (!month || !metricKey) {
						return;
					}

					if (!updatesByMonth[month]) {
						updatesByMonth[month] = {};
					}
					if (!updatesByMonth[month][metricKey]) {
						updatesByMonth[month][metricKey] = {
							values: [],
							distributionMode: String(update.distributionMode || '').trim(),
						};
					}

					updatesByMonth[month][metricKey].values[Number(update.weekIndex || 0)] = Number(update.value || 0);
					if (update.distributionMode) {
						updatesByMonth[month][metricKey].distributionMode = String(update.distributionMode || '').trim();
					}
				});

				Object.keys(updatesByMonth).forEach(function(month) {
					const cacheKey = buildWeeklyOverridesCacheKey(scopeId, month);
					const cached = normalizeWeeklyOverridesPayload(state.weeklyOverridesCache[cacheKey], scopeId, month);
					Object.keys(updatesByMonth[month]).forEach(function(metricKey) {
						const entry = updatesByMonth[month][metricKey];
						cached.overrides[metricKey] = {
							values: entry.values.slice(),
							distributionMode: entry.distributionMode,
						};
						if (storeId) {
							cached.storeOverrides[storeId] = cached.storeOverrides[storeId] || {};
							cached.storeOverrides[storeId][metricKey] = {
								values: entry.values.slice(),
								distributionMode: entry.distributionMode,
							};
						}
					});
					state.weeklyOverridesCache[cacheKey] = cached;
					delete state.weeklyOverridesLoading[cacheKey];
				});
			}

			function buildWeeklyTransportUpdates(adjustmentUpdates) {
				return (adjustmentUpdates || []).reduce(function(rows, update) {
					const weeklyValues = getPendingWeeklyAdjustmentValues(update.metric, update.month);
					if (!Array.isArray(weeklyValues) || !weeklyValues.length) {
						return rows;
					}

					const buckets = buildMonthWeekBuckets(update.month);
					const snapshot = getMetricSnapshot(state.dashboard, update.metric, update.month);
					const distributionMode = getWeeklyDistributionMode(snapshot);
					buckets.forEach(function(bucket, index) {
						rows.push({
							metric: update.metric,
							month: update.month,
							weekIndex: index,
							weekLabel: bucket.label,
							rangeLabel: bucket.rangeLabel,
							value: Number(weeklyValues[index] || 0),
							distributionMode: distributionMode,
						});
					});
					return rows;
				}, []);
			}

			function getStoredAdjustmentUpdateValue(payload, metric, month, uiValue) {
				const section = findSectionByMetric(payload, metric);
				if (!usesUnifiedForecastInput(section)) {
					return Number(uiValue || 0);
				}

				const monthIndex = payload && Array.isArray(payload.months) ? payload.months.indexOf(month) : -1;
				const planRow = section && Array.isArray(section.rows)
					? section.rows.find(function(row) { return row.type === 'plan'; })
					: null;
				if (monthIndex === -1 || !planRow || !Array.isArray(planRow.values)) {
					return Number(uiValue || 0);
				}

				return normalizeStoredMetricValue(Number(uiValue || 0) - Number(planRow.values[monthIndex] || 0), section.format);
			}

			function getForecastValueForMetric(payload, metric, monthIndex) {
				const section = findSectionByMetric(payload, metric);
				const row = section && section.rows ? section.rows.find(function(item) { return item.type === 'forecast'; }) : null;
				return Number(row && row.values ? row.values[monthIndex] : 0);
			}

			function getWorkforceStructureHoursValue(payload, monthIndex) {
				const section = findSectionByMetric(payload, 'Ĺ truktĂşra filiĂˇlky (plnĂ© ĂşvĂ¤zky)');
				const row = section && section.rows ? section.rows.find(function(item) { return item.type === 'structure-hours-derived'; }) : null;
				return Number(row && row.values ? row.values[monthIndex] : 0);
			}

			function refreshLocalPreview() {
				if (!state.dashboard) {
					return;
				}

				state.previewDashboard = buildPreviewDashboard(state.dashboard);
				renderTopWidgets(state.previewDashboard);
				renderCharts(state.previewDashboard);
				renderMetricTable(state.previewDashboard);
			}

			function buildPreviewDashboard(basePayload) {
				const preview = JSON.parse(JSON.stringify(basePayload));
				applyPendingRowsToPreview(basePayload, preview);
				return preview;
			}

			function applyPendingRowsToPreview(basePayload, previewPayload) {
				previewPayload.table.forEach(function(section) {
					const baseSection = findSectionByMetric(basePayload, section.metric);
					if (!baseSection) {
						return;
					}

					if (normalizeMetricName(section.metric) === normalizeMetricName('Ĺ truktĂşra filiĂˇlky (plnĂ© ĂşvĂ¤zky)')) {
						applyWorkforcePreviewSection(baseSection, section, previewPayload.months);
						return;
					}

					applyAdjustmentPreviewSection(baseSection, section, previewPayload.months);
				});

				recomputeGrossPreview(previewPayload);
				recomputeNetPreview(previewPayload, basePayload);
				recomputePerformancePreview(previewPayload);
			}

			function applyAdjustmentPreviewSection(baseSection, previewSection, months) {
				const adjustmentRow = previewSection.rows.find(function(row) { return row.type === 'adjustment'; });
				const planRow = previewSection.rows.find(function(row) { return row.type === 'plan'; });
				const realRow = previewSection.rows.find(function(row) { return row.type === 'real'; });
				const forecastRow = previewSection.rows.find(function(row) { return row.type === 'forecast'; });
				const deltaRow = previewSection.rows.find(function(row) { return row.type === 'delta'; });
				const baseForecastRow = baseSection.rows.find(function(row) { return row.type === 'forecast'; });
				const roundMode = getRoundModeForFormat(previewSection.format);

				if (!adjustmentRow || !planRow || !forecastRow || !baseForecastRow) {
					return;
				}

				forecastRow.values = months.map(function(month, index) {
					const hasActual = hasActualRealValue(realRow, index);
					if (hasActual) {
						return Number(getActualRealValue(realRow, index) || 0);
					}
					const pendingValue = getPendingAdjustmentValue(previewSection.metric, month);
					return pendingValue != null ? Number(pendingValue) : Number(baseForecastRow.values[index] || 0);
				});
				forecastRow.total = roundPreviewValue(sumArray(forecastRow.values), roundMode);

				adjustmentRow.values = months.map(function(month, index) {
					const hasActual = hasActualRealValue(realRow, index);
					if (hasActual) {
						return 0;
					}
					return roundPreviewValue(Number(forecastRow.values[index] || 0) - Number(planRow.values[index] || 0), roundMode);
				});
				adjustmentRow.total = roundPreviewValue(sumArray(adjustmentRow.values), roundMode);

				if (deltaRow) {
					deltaRow.values = getMetricDeltaValues(previewSection, planRow, realRow, forecastRow).map(function(value) {
						return roundPreviewValue(value, roundMode);
					});
					deltaRow.total = roundPreviewValue(sumArray(deltaRow.values), roundMode);
				}
			}

			function applyWorkforcePreviewSection(baseSection, previewSection, months) {
				const workingDaysRow = previewSection.rows.find(function(row) { return row.type === 'static-plan' && normalizeMetricName(row.label) === normalizeMetricName('PracovnĂ© dni zamestnancov'); });
				const holidayRow = previewSection.rows.find(function(row) { return row.type === 'static-plan' && normalizeMetricName(row.label) === normalizeMetricName('Sviatok zatvorenĂ©'); });
				const mixRow = previewSection.rows.find(function(row) { return row.type === 'structure-mix'; });
				const totalRow = previewSection.rows.find(function(row) { return row.type === 'workforce-total'; });
				const structureHoursRow = previewSection.rows.find(function(row) { return row.type === 'structure-hours-derived'; });
				const baseMixRow = baseSection.rows.find(function(row) { return row.type === 'structure-mix'; });

				if (!workingDaysRow || !holidayRow || !mixRow || !totalRow || !structureHoursRow || !baseMixRow) {
					return;
				}

				mixRow.values = months.map(function(month, index) {
					const baseMix = baseMixRow.values[index] || { bands: [], totalAdjustment: 0 };
					const bands = (baseMix.bands || []).map(function(band) {
						const pendingValue = getPendingAdjustmentValue(band.key, month);
						return {
							key: band.key,
							label: band.label,
							fteWeight: Number(band.fteWeight || 0),
							hoursWeight: Number(band.hoursWeight || 0),
							planCount: Number(band.planCount || 0),
							realCount: Number(band.realCount || 0),
							hasRealCount: Boolean(band.hasRealCount),
							count: pendingValue != null ? Number(pendingValue) : Number(band.count || 0),
						};
					});

					return {
						bands: bands,
						totalAdjustment: bands.reduce(function(sum, band) {
							return sum + (Number(band.count || 0) * Number(band.fteWeight || 0));
						}, 0),
						planTotalAdjustment: Number(baseMix.planTotalAdjustment || 0),
						realTotalAdjustment: baseMix.realTotalAdjustment != null ? Number(baseMix.realTotalAdjustment) : null,
						hasRealMix: Boolean(baseMix.hasRealMix),
						isStructureMix: true,
					};
				});

				totalRow.values = mixRow.values.map(function(mix) {
					return roundPreviewValue(mix.totalAdjustment || 0, 'decimal');
				});
				totalRow.total = roundPreviewValue(averageArray(totalRow.values), 'decimal');

				structureHoursRow.values = mixRow.values.map(function(mix, index) {
					const dailyHours = (mix.bands || []).reduce(function(sum, band) {
						return sum + (Number(band.count || 0) * Number(band.hoursWeight || 0));
					}, 0);
					const structureDays = Number(workingDaysRow.values[index] || 0) + Number(holidayRow.values[index] || 0);
					return roundPreviewValue(dailyHours * structureDays, 'decimal');
				});
				structureHoursRow.total = roundPreviewValue(sumArray(structureHoursRow.values), 'decimal');
			}

			function hasPendingGrossDependencyChanges() {
				const dependencyMetrics = [
					'Ĺ truktĂşra filiĂˇlky 100%',
					'Ĺ truktĂşra filiĂˇlky 90%',
					'Ĺ truktĂşra filiĂˇlky 77%',
					'Ĺ truktĂşra filiĂˇlky 65%',
					'Ĺ truktĂşra filiĂˇlky 52%',
					'Ĺ truktĂşra filiĂˇlky 39%',
					'StruktĂşra filiĂˇlky (plnĂ© ĂşvĂ¤zky)',
					'Ĺ truktĂşra filiĂˇlky (plnĂ© ĂşvĂ¤zky)',
					'Ĺ truktĂşra hodĂ­n',
					'DlhodobĂˇ neprĂ­tomnosĹĄ (33+ dnĂ­) (b)'
				];

				return dependencyMetrics.some(function(metric) {
					return state.pendingAdjustments[metric] && Object.keys(state.pendingAdjustments[metric]).length > 0;
				});
			}

			function recomputeGrossPreview(previewPayload) {
				const grossSection = findSectionByMetric(previewPayload, 'Hodiny Brutto GJ2026');
				const workforceSection = findSectionByMetric(previewPayload, 'Ĺ truktĂşra filiĂˇlky (plnĂ© ĂşvĂ¤zky)');
				const longAbsenceSection = findSectionByMetric(previewPayload, 'DlhodobĂˇ neprĂ­tomnosĹĄ (33+ dnĂ­) (b)');
				if (!grossSection || !workforceSection || !longAbsenceSection) {
					return;
				}

				const structureHoursRow = workforceSection.rows.find(function(row) { return row.type === 'structure-hours-derived'; });
				const structureHoursPlanRow = workforceSection.rows.find(function(row) { return row.type === 'structure-hours-plan'; }) || structureHoursRow;
				const structureHoursRealRow = workforceSection.rows.find(function(row) { return row.type === 'structure-hours-real'; }) || structureHoursPlanRow;
				const longPlanRow = longAbsenceSection.rows.find(function(row) { return row.type === 'plan'; });
				const longRealRow = longAbsenceSection.rows.find(function(row) { return row.type === 'real'; });
				const longForecastRow = longAbsenceSection.rows.find(function(row) { return row.type === 'forecast'; }) || longPlanRow;
				const planRow = grossSection.rows.find(function(row) { return row.type === 'plan'; });
				const realRow = grossSection.rows.find(function(row) { return row.type === 'real'; });
				const adjustmentRow = grossSection.rows.find(function(row) { return row.type === 'adjustment'; });
				const forecastRow = grossSection.rows.find(function(row) { return row.type === 'forecast'; });
				const deltaRow = grossSection.rows.find(function(row) { return row.type === 'delta'; });
				if (!structureHoursRow || !structureHoursPlanRow || !structureHoursRealRow || !longPlanRow || !planRow || !realRow || !adjustmentRow || !forecastRow) {
					return;
				}

				planRow.values = previewPayload.months.map(function(month, index) {
					return roundPreviewValue(
						Number(structureHoursPlanRow.values[index] || 0) - Number(longPlanRow.values[index] || 0),
						'integer'
					);
				});
				planRow.total = roundPreviewValue(sumArray(planRow.values), 'integer');

				const grossActualValues = previewPayload.months.map(function(month, index) {
					const hasStructureActual = hasActualRealValue(structureHoursRealRow, index);
					const hasLongActual = hasActualRealValue(longRealRow, index);
					if (!hasStructureActual && !hasLongActual) {
						return 0;
					}

					const structureActual = hasStructureActual
						? Number(getActualRealValue(structureHoursRealRow, index) || 0)
						: Number(structureHoursPlanRow.values[index] || 0);
					const longActual = hasLongActual
						? Number(getActualRealValue(longRealRow, index) || 0)
						: Number(longPlanRow.values[index] || 0);
					return roundPreviewValue(structureActual - longActual, 'integer');
				});
				const grossHasActualFlags = previewPayload.months.map(function(month, index) {
					return hasActualRealValue(structureHoursRealRow, index) || hasActualRealValue(longRealRow, index);
				});
				realRow.actualValues = grossActualValues.slice();
				realRow.hasRealFlags = grossHasActualFlags.slice();
				realRow.values = previewPayload.months.map(function(month, index) {
					return grossHasActualFlags[index] ? Number(grossActualValues[index] || 0) : Number(planRow.values[index] || 0);
				});
				realRow.total = roundPreviewValue(sumArray(realRow.values), 'integer');
				realRow.actualTotal = roundPreviewValue(sumArray(grossActualValues.filter(function(value, index) {
					return grossHasActualFlags[index];
				})), 'integer');

				forecastRow.values = previewPayload.months.map(function(month, index) {
					const hasActual = hasActualRealValue(realRow, index);
					if (hasActual) {
						return Number(getActualRealValue(realRow, index) || 0);
					}

					const longTermValue = hasActualRealValue(longRealRow, index)
						? Number(getActualRealValue(longRealRow, index) || 0)
						: Number(longForecastRow.values[index] || 0);

					return roundPreviewValue(Number(structureHoursRow.values[index] || 0) - longTermValue, 'integer');
				});
				forecastRow.total = roundPreviewValue(sumArray(forecastRow.values), 'integer');

				adjustmentRow.values = previewPayload.months.map(function(month, index) {
					const hasActual = hasActualRealValue(realRow, index);
					if (hasActual) {
						return 0;
					}

					return roundPreviewValue(Number(forecastRow.values[index] || 0) - Number(planRow.values[index] || 0), 'integer');
				});
				adjustmentRow.total = roundPreviewValue(sumArray(adjustmentRow.values), 'integer');

				if (deltaRow) {
					deltaRow.values = getMetricDeltaValues(grossSection, planRow, realRow, forecastRow).map(function(value) {
						return roundPreviewValue(value, 'integer');
					});
					deltaRow.total = roundPreviewValue(sumArray(deltaRow.values), 'integer');
				}
			}

			function recomputeNetPreview(previewPayload, basePayload) {
				const netSection = findSectionByMetric(previewPayload, 'Hodiny netto');
				const baseNetSection = findSectionByMetric(basePayload, 'Hodiny netto');
				if (!netSection || !baseNetSection) {
					return;
				}

				const months = previewPayload.months;
				const planRow = netSection.rows.find(function(row) { return row.type === 'plan'; });
				const realRow = netSection.rows.find(function(row) { return row.type === 'real'; });
				const adjustmentRow = netSection.rows.find(function(row) { return row.type === 'adjustment'; });
				const forecastRow = netSection.rows.find(function(row) { return row.type === 'forecast'; });
				const deltaRow = netSection.rows.find(function(row) { return row.type === 'delta'; });
				const baseForecastRow = baseNetSection.rows.find(function(row) { return row.type === 'forecast'; });

				if (!planRow || !adjustmentRow || !forecastRow || !baseForecastRow) {
					return;
				}

				forecastRow.values = months.map(function(month, index) {
					const hasActual = hasActualRealValue(realRow, index);
					if (hasActual) {
						return Number(getActualRealValue(realRow, index) || 0);
					}

					const pendingValue = getPendingAdjustmentValue(netSection.metric, month);
					if (pendingValue != null) {
						return Number(pendingValue);
					}

					return roundPreviewValue(Number(baseForecastRow.values[index] || 0) + computeNetImpactDelta(previewPayload, basePayload, index), 'integer');
				});
				forecastRow.total = roundPreviewValue(sumArray(forecastRow.values), 'integer');

				adjustmentRow.values = months.map(function(month, index) {
					const hasActual = hasActualRealValue(realRow, index);
					if (hasActual) {
						return 0;
					}
					return roundPreviewValue(Number(forecastRow.values[index] || 0) - Number(planRow.values[index] || 0), 'integer');
				});
				adjustmentRow.total = roundPreviewValue(sumArray(adjustmentRow.values), 'integer');

				if (deltaRow) {
					deltaRow.values = getMetricDeltaValues(netSection, planRow, realRow, forecastRow).map(function(value) {
						return roundPreviewValue(value, 'integer');
					});
					deltaRow.total = roundPreviewValue(sumArray(deltaRow.values), 'integer');
				}
			}

			function computeNetImpactDelta(previewPayload, basePayload, monthIndex) {
				const structureDelta = getWorkforceStructureHoursValue(previewPayload, monthIndex) - getWorkforceStructureHoursValue(basePayload, monthIndex);
				return computeNetHoursDelta(structureDelta, function(metric) {
					return getForecastValueForMetric(previewPayload, metric, monthIndex) - getForecastValueForMetric(basePayload, metric, monthIndex);
				});
			}

			function recomputePerformancePreview(previewPayload) {
				const performanceSection = findSectionByMetric(previewPayload, 'ÄŚistĂ˝ vĂ˝kon');
				const turnoverSection = findSectionByMetric(previewPayload, 'Obrat GJ2026');
				const netSection = findSectionByMetric(previewPayload, 'Hodiny netto');
				if (!performanceSection || !turnoverSection || !netSection) {
					return;
				}

				const planRow = performanceSection.rows.find(function(row) { return row.type === 'plan'; });
				const realRow = performanceSection.rows.find(function(row) { return row.type === 'real'; });
				const forecastRow = performanceSection.rows.find(function(row) { return row.type === 'forecast'; });
				const deltaRow = performanceSection.rows.find(function(row) { return row.type === 'delta'; });
				const turnoverForecastRow = turnoverSection.rows.find(function(row) { return row.type === 'forecast'; });
				const netForecastRow = netSection.rows.find(function(row) { return row.type === 'forecast'; });

				if (!planRow || !forecastRow || !turnoverForecastRow || !netForecastRow) {
					return;
				}

				forecastRow.values = previewPayload.months.map(function(month, index) {
					const turnoverValue = Number(turnoverForecastRow.values[index] || 0);
					const netValue = Number(netForecastRow.values[index] || 0);
					return roundPreviewValue(netValue ? turnoverValue / netValue : 0, 'decimal');
				});
				forecastRow.total = roundPreviewValue(Number(netForecastRow.total || 0) ? Number(turnoverForecastRow.total || 0) / Number(netForecastRow.total || 0) : 0, 'decimal');

				if (deltaRow) {
					deltaRow.values = getMetricDeltaValues(performanceSection, planRow, realRow, forecastRow).map(function(value) {
						return roundPreviewValue(value, 'decimal');
					});
					deltaRow.total = roundPreviewValue(sumArray(deltaRow.values), 'decimal');
				}
			}

			function sanitizeStoreDisplayName(storeId, storeName) {
				const normalizedStoreId = String(storeId || '').trim();
				let cleanedName = String(storeName || '').trim().replace(/\s+/g, ' ');

				if (!normalizedStoreId || !cleanedName) {
					return cleanedName;
				}

				for (let attempt = 0; attempt < 5; attempt += 1) {
					const parts = cleanedName.split(/\s+/).filter(Boolean);
					if (!parts.length) {
						return '';
					}
					if (normalizeMetricName(parts[0]) !== normalizeMetricName(normalizedStoreId)) {
						break;
					}
					parts.shift();
					cleanedName = parts.join(' ').trim();
				}

				return cleanedName;
			}

			function formatStoreDisplayLabel(storeId, storeName) {
				const normalizedStoreId = String(storeId || '').trim();
				const cleanedName = sanitizeStoreDisplayName(normalizedStoreId, storeName);
				return [normalizedStoreId, cleanedName].filter(Boolean).join(' ');
			}

			function saveAdjustments() {
				hideSaveStatus();
				saveDashboardChanges_({
					silent: false,
					includeAdjustments: true,
					includeNotes: true,
					autoSave: false,
				});
			}

			function queueAutoSaveAdjustments() {
				if (!state.dashboard || state.dashboard.user.role !== 'VOD' || state.dashboard.scope.type !== 'STORE') {
					return;
				}

				if (state.autoSaveTimer) {
					clearTimeout(state.autoSaveTimer);
				}

				state.autoSaveTimer = setTimeout(function() {
					state.autoSaveTimer = null;
					saveDashboardChanges_({
						silent: true,
						includeAdjustments: true,
						includeNotes: false,
						autoSave: true,
					});
				}, 450);
			}

			function handleManualRecalculate() {
				if (!state.dashboard) {
					return;
				}

				hideSaveStatus();
				if (!hasPendingAdjustmentChanges()) {
					state.previewDashboard = null;
					renderTopWidgets(state.dashboard);
					renderCharts(state.dashboard);
					renderMetricTable(state.dashboard);
					return;
				}

				refreshLocalPreview();
			}

			function hasPendingAdjustmentChanges() {
				return Object.keys(state.pendingAdjustments).some(function(metric) {
					return Object.keys(state.pendingAdjustments[metric] || {}).length > 0;
				});
			}

			function saveDashboardChanges_(options) {
				const config = options || {};
				if (!state.dashboard) {
					if (!config.silent) {
						alert('Dashboard eĹˇte nie je naÄŤĂ­tanĂ˝.');
					}
					if (typeof config.onFailure === 'function') {
						config.onFailure(new Error('Dashboard eĹˇte nie je naÄŤĂ­tanĂ˝.'));
					}
					return;
				}

				if (state.autoSaveTimer && !config.autoSave) {
					clearTimeout(state.autoSaveTimer);
					state.autoSaveTimer = null;
				}

				const canSaveAdjustments = state.dashboard.user.role === 'VOD' && state.dashboard.scope.type === 'STORE';
				const canSaveNotes = state.dashboard.user.role === 'VOD' || state.dashboard.user.role === 'VKL';
				const updates = [];
				if (config.includeAdjustments !== false) {
					Object.keys(state.pendingAdjustments).forEach(function(metric) {
						if (normalizeMetricName(metric) === normalizeMetricName('Ĺ truktĂşra hodĂ­n')) {
							return;
						}
						Object.keys(state.pendingAdjustments[metric]).forEach(function(month) {
							const uiValue = Number(state.pendingAdjustments[metric][month] || 0);
							updates.push({
								metric: metric,
								month: month,
								uiValue: uiValue,
								value: getStoredAdjustmentUpdateValue(state.dashboard, metric, month, uiValue),
							});
						});
					});
				}
				const noteUpdates = (config.includeNotes === false ? [] : (function() {
					const userRole = state.dashboard.user.role;
					const currentNoteScopeMode = userRole === 'VKL' ? getCurrentVklNoteTargetForRequest() : 'scope';
					const noteMetrics = [GLOBAL_SCOPE_NOTE_KEY].concat(getNoteModalMetrics(state.dashboard));
					return noteMetrics.reduce(function(result, metric) {
						const draftKey = buildPendingNoteKey(metric, userRole, currentNoteScopeMode);
						if (!Object.prototype.hasOwnProperty.call(state.pendingNotes, draftKey)) {
							return result;
						}
						result.push({
							metric: metric,
							text: state.pendingNotes[draftKey],
							draftKey: draftKey,
						});
						return result;
					}, []);
				})());

				if ((!updates.length || !canSaveAdjustments) && (!noteUpdates.length || !canSaveNotes)) {
					if (!config.silent) {
						alert('Nie sĂş pripravenĂ© Ĺľiadne zmeny na uloĹľenie.');
					}
					if (typeof config.onSuccess === 'function') {
						config.onSuccess({ savedAdjustments: 0, savedNotes: 0, skipped: true });
					}
					return;
				}

				const savedUpdates = updates.map(function(item) {
					return { metric: item.metric, month: item.month, value: item.uiValue };
				});
				const transportUpdates = updates.map(function(item) {
					return { metric: item.metric, month: item.month, value: item.value };
				});
				const weeklyTransportUpdates = canSaveAdjustments ? buildWeeklyTransportUpdates(updates) : [];
				const savedNotes = noteUpdates.map(function(item) {
					return { metric: item.metric, text: item.text, draftKey: item.draftKey };
				});
				const useBlockingLoader = !config.autoSave;

				if (useBlockingLoader) {
					setLoadingState(true, {
						action: 'save',
						title: 'UkladĂˇm zmeny',
						subtitle: 'Zapisujem Ăşpravy a poznĂˇmky do Google Sheets.',
					});
				} else {
					showSaveStatus('saving', 'UkladĂˇm...');
				}
				google.script.run
					.withSuccessHandler(function(result) {
						invalidateWeeklyOverridesCache();
						applySavedWeeklyOverridesToCache(weeklyTransportUpdates);
						if (savedUpdates.length) {
							applySavedAdjustmentsToDashboard(savedUpdates);
							removeSavedPendingAdjustments(savedUpdates);
						}
						if (savedNotes.length) {
							removeSavedPendingNotes(savedNotes);
						}

						if (config.autoSave) {
							if (hasPendingDashboardChanges()) {
								refreshLocalPreview();
							} else {
								state.previewDashboard = null;
								renderTopWidgets(state.dashboard);
								renderCharts(state.dashboard);
								renderMetricTable(state.dashboard);
								loadDashboard(state.dashboard.scope.id, { silent: true });
							}
							showSaveStatus('success', 'UloĹľenĂ©');
							if (typeof config.onSuccess === 'function') {
								config.onSuccess(result || {});
							}
							return;
						}

						if (config.skipReloadOnSuccess) {
							if (useBlockingLoader) {
								setLoadingState(false);
							}
							if (typeof config.onSuccess === 'function') {
								config.onSuccess(result || {});
							}
							return;
						}

						if (!config.silent) {
							const messages = [];
							if (result.savedAdjustments) {
								messages.push('upravy: ' + result.savedAdjustments);
							}
							if (result.savedWeeklyAdjustments) {
								messages.push('tyzdne: ' + result.savedWeeklyAdjustments);
							}
							if (result.savedNotes) {
								messages.push('poznamky: ' + result.savedNotes);
							}
							alert('UloĹľenĂ© zmeny: ' + (messages.join(' â€˘ ') || '0'));
						}
						if (typeof config.onSuccess === 'function') {
							config.onSuccess(result || {});
						}
						loadDashboard(state.dashboard.scope.id);
					})
					.withFailureHandler(function(error) {
						if (useBlockingLoader) {
							setLoadingState(false);
						} else {
							showSaveStatus('error', 'NeuloĹľenĂ©');
						}
						if (!config.silent) {
							alert(error.message || 'Nepodarilo sa uloĹľiĹĄ zmeny.');
						}
						if (typeof config.onFailure === 'function') {
							config.onFailure(error);
						}
					})
					.saveDashboardChanges(
						state.loginValue,
						state.dashboard.scope.id,
						canSaveAdjustments ? transportUpdates : [],
						canSaveNotes ? noteUpdates : [],
						weeklyTransportUpdates,
						getCurrentVklNoteTargetForRequest()
					);
			}

			function hasPendingDashboardChanges() {
				return Object.keys(state.pendingAdjustments).some(function(metric) {
					return Object.keys(state.pendingAdjustments[metric] || {}).length > 0;
				}) || Object.keys(state.pendingNotes).length > 0;
			}

			function removeSavedPendingAdjustments(savedUpdates) {
				savedUpdates.forEach(function(update) {
					if (!state.pendingAdjustments[update.metric]) {
						return;
					}
					removePendingWeeklyAdjustmentValues(update.metric, update.month);
					delete state.pendingAdjustments[update.metric][update.month];
					if (!Object.keys(state.pendingAdjustments[update.metric]).length) {
						delete state.pendingAdjustments[update.metric];
					}
				});
			}

			function removeSavedPendingNotes(savedNotes) {
				savedNotes.forEach(function(note) {
					if (state.pendingNotes[note.draftKey] === note.text) {
						delete state.pendingNotes[note.draftKey];
					}
					delete state.metricNotesCache[buildMetricNotesCacheKey(note.metric)];
					delete state.metricNotesLoading[buildMetricNotesCacheKey(note.metric)];
				});
				renderScopeNotesIndicator();
			}

			function applySavedAdjustmentsToDashboard(savedUpdates) {
				if (!state.dashboard || !savedUpdates.length) {
					return;
				}

				const scopedPending = {};
				savedUpdates.forEach(function(update) {
					if (!scopedPending[update.metric]) {
						scopedPending[update.metric] = {};
					}
					scopedPending[update.metric][update.month] = update.value;
				});

				const originalPending = state.pendingAdjustments;
				state.pendingAdjustments = scopedPending;
				state.dashboard = buildPreviewDashboard(state.dashboard);
				state.pendingAdjustments = originalPending;
			}

			function renderOrUpdateChart(id, config) {
				const existing = state.charts[id];
				if (existing && existing.config.type === config.type) {
					existing.data = config.data;
					Object.assign(existing.options, config.options || {});
					if (config.plugins) { existing.config.plugins = config.plugins; }
					existing.update();
					return;
				}
				if (existing) { existing.destroy(); }
				state.charts[id] = new Chart(document.getElementById(id), config);
			}

			function chartOptions(format, options) {
				const config = options || {};
				return {
					responsive: true,
					maintainAspectRatio: false,
					layout: {
						padding: {
							top: config.chartPaddingTop != null ? config.chartPaddingTop : 44,
							right: 10,
							left: 6,
						}
					},
					interaction: { mode: 'index', intersect: false },
					plugins: {
						staticValueLabels: {
							display: true,
							format: format,
							mode: config.labelMode || 'all',
							insideBarColor: getThemeColor('--badge-bg', '#ffffff'),
							outsideBarColor: getThemeColor('--brand', '#c0352b')
						},
						legend: { labels: { color: getThemeColor('--chart-legend-text', '#4b5563'), usePointStyle: true, boxWidth: 8, font: { family: 'IBM Plex Sans', weight: '600' } } },
						tooltip: {
							backgroundColor: getThemeColor('--tooltip-bg', 'rgba(19, 35, 52, 0.94)'),
							titleFont: { family: 'IBM Plex Sans', weight: '700' },
							bodyFont: { family: 'IBM Plex Sans', weight: '500' },
							displayColors: true,
							callbacks: {
								label: function(context) {
									const targetFormat = context.dataset.valueFormat || (format === 'mixed' ? 'hours' : format);
									return context.dataset.label + ': ' + formatMetric(context.raw, targetFormat);
								}
							}
						}
					},
					scales: {
						x: {
							grid: { display: false },
							ticks: { color: getThemeColor('--muted', '#475569'), font: { family: 'IBM Plex Sans', weight: '600' } }
						},
						y: {
							grid: { color: getThemeColor('--grid', 'rgba(15, 23, 42, 0.10)') },
							ticks: {
								color: getThemeColor('--muted', '#475569'),
								callback: function(value) { return shortMetric(value, format === 'mixed' ? 'hours' : format); },
								font: { family: 'IBM Plex Sans', weight: '600' }
							}
						}
					}
				};
			}

			function formatMetric(value, format) {
				if (format === 'currency') {
					return currencyFormatter.format(Number(value || 0));
				}
				if (format === 'fte') {
					return numberFormatter.format(Number(value || 0));
				}
				if (format === 'number') {
					return numberFormatter.format(Number(value || 0));
				}
				return numberFormatter.format(Number(value || 0)) + ' h';
			}

			function shortMetric(value, format) {
				const raw = Number(value || 0);
				const normalizedFormat = format === 'mixed' ? 'hours' : format;
				if (normalizedFormat === 'currency') {
					return formatAbbreviatedCurrency(raw);
				}
				if (normalizedFormat === 'number' || normalizedFormat === 'fte') {
					return numberFormatter.format(raw);
				}
				return numberFormatter.format(raw / 1000) + 'k';
			}

			function formatChartValueLabel(value, format) {
				const raw = Number(value || 0);
				const normalizedFormat = format === 'mixed' ? 'hours' : format;
				if (normalizedFormat === 'currency') {
					return formatAbbreviatedCurrency(raw);
				}
				if (normalizedFormat === 'number' || normalizedFormat === 'fte') {
					return numberFormatter.format(raw);
				}
				return numberFormatter.format(raw / 1000) + 'k';
			}

			function formatAbbreviatedCurrency(value) {
				const raw = Number(value || 0);
				const absolute = Math.abs(raw);
				if (absolute >= 999500) {
					return numberFormatter.format(raw / 1000000) + ' Mâ‚¬';
				}
				if (absolute >= 1000) {
					return numberFormatter.format(raw / 1000) + ' kâ‚¬';
				}
				return currencyFormatter.format(raw);
			}

			function formatPercent(value) {
				const pct = Number(value || 0) * 100;
				return (pct >= 0 ? '+' : '') + numberFormatter.format(pct) + '%';
			}

			function formatSignedMetric(value, format) {
				const numericValue = Number(value || 0);
				if (numericValue > 0) {
					return '+' + formatMetric(numericValue, format);
				}
				return formatMetric(numericValue, format);
			}

			function getDeltaClass(value) {
				return Number(value || 0) >= 0 ? 'positive' : 'negative';
			}

			function getDeltaCellClass(value) {
				const numericValue = Number(value || 0);
				if (numericValue > 0) {
					return 'delta-positive';
				}
				if (numericValue < 0) {
					return 'delta-negative';
				}
				return 'delta-neutral';
			}

			function getForecastCellClass(forecastValue, planValue) {
				const forecast = Number(forecastValue || 0);
				const plan = Number(planValue || 0);
				if (forecast < plan) {
					return 'forecast-negative';
				}
				if (forecast > plan) {
					return 'forecast-positive';
				}
				return 'forecast-neutral';
			}

			function formatMonthShort(label) {
				const value = String(label || '').trim();
				const parts = value.split(/\s+/);
				if (parts.length < 2) {
					return value;
				}

				const map = {
					januar: 'Jan',
					'januĂˇr': 'Jan',
					februar: 'Feb',
					'februĂˇr': 'Feb',
					marec: 'Mar',
					april: 'Apr',
					'aprĂ­l': 'Apr',
					maj: 'May',
					jun: 'Jun',
					'jĂşn': 'Jun',
					jul: 'Jul',
					'jĂşl': 'Jul',
					august: 'Aug',
					september: 'Sep',
					oktober: 'Oct',
					'oktĂłber': 'Oct',
					november: 'Nov',
					december: 'Dec'
				};

				return (map[parts[0].toLowerCase()] || parts[0]) + ' ' + parts[1];
			}

			function showSaveStatus(status, message) {
				const toast = document.getElementById('saveStatusToast');
				if (!toast) {
					return;
				}

				if (state.saveStatusTimer) {
					clearTimeout(state.saveStatusTimer);
					state.saveStatusTimer = null;
				}

				toast.textContent = message || '';
				toast.classList.remove('hidden', 'is-saving', 'is-success', 'is-error');
				toast.classList.add('is-' + status);

				if (status === 'success' || status === 'error') {
					state.saveStatusTimer = setTimeout(function() {
						hideSaveStatus();
					}, status === 'success' ? 1600 : 2400);
				}
			}

			function hideSaveStatus() {
				const toast = document.getElementById('saveStatusToast');
				if (!toast) {
					return;
				}

				if (state.saveStatusTimer) {
					clearTimeout(state.saveStatusTimer);
					state.saveStatusTimer = null;
				}

				toast.classList.add('hidden');
				toast.classList.remove('is-saving', 'is-success', 'is-error');
			}

			function setLoadingState(isLoading, options) {
				const config = options || {};
				state.loading.active = isLoading;
				state.loading.action = isLoading ? (config.action || '') : '';

				const loginButton = document.getElementById('loginButton');
				const refreshButton = document.getElementById('refreshButton');
				const saveButton = document.getElementById('saveButton');
				const saveFabButton = document.getElementById('saveFabButton');
				const logoutButton = document.getElementById('logoutButton');
				const collapseAllMetricsButton = document.getElementById('collapseAllMetricsButton');
				const expandAllMetricsButton = document.getElementById('expandAllMetricsButton');
				const loader = document.getElementById('appLoader');
				const activityBar = document.getElementById('activityBar');
				const loaderTitle = document.getElementById('loaderTitle');
				const loaderSubtitle = document.getElementById('loaderSubtitle');

				loginButton.disabled = isLoading;
				refreshButton.disabled = isLoading;
				saveButton.disabled = isLoading;
				saveFabButton.disabled = isLoading;
				logoutButton.disabled = isLoading;
				if (isLoading) {
					collapseAllMetricsButton.disabled = true;
					expandAllMetricsButton.disabled = true;
				}

				loginButton.classList.toggle('is-loading', isLoading && state.loading.action === 'load' && !state.dashboard);
				refreshButton.classList.toggle('is-loading', isLoading && state.loading.action === 'load' && Boolean(state.dashboard));
				saveButton.classList.toggle('is-loading', isLoading && state.loading.action === 'save');
				saveFabButton.classList.toggle('is-loading', isLoading && state.loading.action === 'save');

				if (isLoading) {
					loaderTitle.textContent = config.title || 'SpracĂşvam poĹľiadavku';
					loaderSubtitle.textContent = config.subtitle || 'Pracujem s dĂˇtami aplikĂˇcie.';
					loader.classList.remove('hidden');
					activityBar.classList.remove('hidden');
					document.body.classList.add('is-busy');
				} else {
					loader.classList.add('hidden');
					activityBar.classList.add('hidden');
					document.body.classList.remove('is-busy');
					renderMetricCollapseControls(getActiveDashboard());
				}
			}

			function showLoginError(message) {
				const banner = document.getElementById('loginError');
				banner.textContent = message;
				banner.classList.remove('hidden');
			}

			function hideLoginError() {
				document.getElementById('loginError').classList.add('hidden');
			}

