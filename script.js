const PLAN_VOD_CONFIG = {
	planVodSheetName: 'PlanVOD',
	istVodSheetName: 'ISTVODGJ2026',
	legacyIstVodSheetName: 'IstVOD',
	preferredMetricOrder: [
		'Obrat GJ2026',
		'Hodiny netto',
		'Čistý výkon',
		'Dovolenka (-)',
		'Odmena za dohodu (-)',
		'Odmena za pr.prácu žiak (+) 50%',
		'Nadčasy (+)',
		'PN Krátkodobé',
		'Externá pracovná agentúra (+) Reinigung',
		'Externá pracovná agentúra (+) Wareneinräumung',
		'FiMa/Prestavba/Dodatočné práce/NEO',
		'Inventúra (+)',
		'Saldo DF (-)',
		'Saldo DF (+)',
		'Plat sviatky',
		'Pracovné dni zamestnancov',
		'Sviatok zatvorené',
		'Štruktúra hodín',
		'Štruktúra filiálky (plné úväzky)',
		'Štruktúra filiálky 100%',
		'Štruktúra filiálky 90%',
		'Štruktúra filiálky 77%',
		'Štruktúra filiálky 65%',
		'Štruktúra filiálky 54%',
		'Štruktúra filiálky 52%',
		'Štruktúra filiálky 39%',
		'Dlhodobá neprítomnosť (33+ dní) (b)',
		'Hodiny Brutto GJ2026',
		'Hodiny netto Plan VT',
		'Hodiny netto 2024',
	],
};

const PLAN_VOD_SHORT_PN_METRIC = 'PN (< 10 dní) (-)';
const PLAN_VOD_OTHER_ABSENCE_METRIC = 'Iné (napr. uvoľ z práce, OČR, odber krvi,(-)';
const PLAN_VOD_SHORT_TERM_PN_METRIC = 'PN Krátkodobé';
const PLAN_VOD_SHORT_TERM_PN_SOURCE_METRICS = [PLAN_VOD_SHORT_PN_METRIC, PLAN_VOD_OTHER_ABSENCE_METRIC];

const PLAN_GJ2026_CONFIG = {
	planSheetName: 'PLANGJ2026',
	headers: ['Store ID', 'Store Name', 'Metric'],
};

const IST_GJ2026_CONFIG = {
	realSheetName: 'ISTGJ2026',
	legacyRealSheetName: 'IstReal',
	headers: ['Store ID', 'Store Name', 'Metric'],
};

function createPlanGj2026SheetFromCsv() {
	return rebuildPlanGj2026SheetFromCsv_();
}

function createIstGj2026SheetFromPlan() {
	return rebuildIstGj2026SheetFromPlan_();
}

function rebuildPlanGj2026SheetFromCsv_() {
	const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
	const planData = getPlanCsvMetricData_();
	const buildResult = buildPlanGj2026SheetValues_(planData);

	planVodWriteSheet_(spreadsheet, PLAN_GJ2026_CONFIG.planSheetName, buildResult.values);

	return {
		createdSheet: PLAN_GJ2026_CONFIG.planSheetName,
		storeCount: buildResult.storeCount,
		metricCount: buildResult.metricCount,
		monthCount: planData.months.length,
		rowCount: buildResult.rowCount,
		updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss'),
	};
}

function buildPlanGj2026SheetValues_(planData) {
	const output = [PLAN_GJ2026_CONFIG.headers.concat(planData.months)];
	const importedStoreIds = planVodExtractStoreIds_(planData.records);
	const storeIds = planGj2026ResolveStoreIds_(planData).sort(function(left, right) {
		return String(left).localeCompare(String(right), undefined, { numeric: true });
	});
	const discoveredMetrics = planGj2026ExtractMetrics_(planData.records);
	const metricOrder = planVodBuildMetricOrder_(discoveredMetrics, []).filter(function(metric) {
		return discoveredMetrics.indexOf(metric) > -1;
	});
	const metricIndex = {};
	const rowMap = {};

	metricOrder.forEach(function(metric, index) {
		metricIndex[metric] = index;
	});

	Object.keys(planData.records || {}).forEach(function(key) {
		const parts = String(key || '').split('|');
		if (parts.length < 3) {
			return;
		}

		const storeId = String(parts[0] || '').trim();
		const metric = planVodCanonicalizeMetric_(parts[1]);
		const month = String(parts[2] || '').trim();
		const rowKey = storeId + '|' + metric;

		if (!rowMap[rowKey]) {
			rowMap[rowKey] = {
				storeId: storeId,
				storeName: planData.storeNames[storeId] || '',
				metric: metric,
				valuesByMonth: {},
			};
		}

		rowMap[rowKey].valuesByMonth[month] = planData.records[key];
	});

	storeIds.forEach(function(storeId) {
		metricOrder.forEach(function(metric) {
			const rowKey = storeId + '|' + metric;
			if (!rowMap[rowKey]) {
				rowMap[rowKey] = {
					storeId: storeId,
					storeName: planData.storeNames[storeId] || '',
					metric: metric,
					valuesByMonth: {},
				};
			}
		});
	});

	const rowKeys = Object.keys(rowMap).sort(function(leftKey, rightKey) {
		const left = rowMap[leftKey];
		const right = rowMap[rightKey];
		const storeCompare = left.storeId.localeCompare(right.storeId, undefined, { numeric: true });
		if (storeCompare !== 0) {
			return storeCompare;
		}

		const leftMetricIndex = Object.prototype.hasOwnProperty.call(metricIndex, left.metric) ? metricIndex[left.metric] : Number.MAX_SAFE_INTEGER;
		const rightMetricIndex = Object.prototype.hasOwnProperty.call(metricIndex, right.metric) ? metricIndex[right.metric] : Number.MAX_SAFE_INTEGER;
		if (leftMetricIndex !== rightMetricIndex) {
			return leftMetricIndex - rightMetricIndex;
		}

		return left.metric.localeCompare(right.metric);
	});

	rowKeys.forEach(function(rowKey) {
		const row = rowMap[rowKey];
		output.push([
			row.storeId,
			row.storeName,
			row.metric,
		].concat(planData.months.map(function(month) {
			return Object.prototype.hasOwnProperty.call(row.valuesByMonth, month) ? row.valuesByMonth[month] : '';
		})));
	});

	return {
		values: output,
		rowCount: rowKeys.length,
		storeCount: storeIds.length,
		importedStoreCount: importedStoreIds.length,
		metricCount: discoveredMetrics.length,
	};
}

function planGj2026ResolveStoreIds_(planData) {
	const storeIdIndex = {};

	planVodExtractStoreIds_(planData.records).forEach(function(storeId) {
		storeIdIndex[String(storeId || '').trim()] = true;
	});

	Object.keys(planData.storeNames || {}).forEach(function(storeId) {
		const normalizedStoreId = String(storeId || '').trim();
		if (normalizedStoreId) {
			storeIdIndex[normalizedStoreId] = true;
		}
	});

	return Object.keys(storeIdIndex);
}

function rebuildIstGj2026SheetFromPlan_() {
	const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
	const planSheet = planVodGetRequiredSheet_(spreadsheet, PLAN_GJ2026_CONFIG.planSheetName);
	const planMatrix = planVodReadMatrixSheet_(planSheet);
	const targetSheet = spreadsheet.getSheetByName(IST_GJ2026_CONFIG.realSheetName);
	const legacySheet = spreadsheet.getSheetByName(IST_GJ2026_CONFIG.legacyRealSheetName);
	const sourceSheet = targetSheet || legacySheet;
	const existingRealData = sourceSheet ? planVodReadMatrixSheet_(sourceSheet) : null;
	const buildResult = buildIstGj2026SheetValues_(planMatrix, existingRealData);
	const backupSheetName = targetSheet ? planVodBackupSheet_(spreadsheet, IST_GJ2026_CONFIG.realSheetName) : '';

	planVodWriteSheet_(spreadsheet, IST_GJ2026_CONFIG.realSheetName, buildResult.values);

	return {
		createdSheet: IST_GJ2026_CONFIG.realSheetName,
		sourceSheet: sourceSheet ? sourceSheet.getName() : '',
		backupSheetName: backupSheetName,
		storeCount: buildResult.storeCount,
		metricCount: buildResult.metricCount,
		monthCount: planMatrix.months.length,
		rowCount: buildResult.rowCount,
		migratedValueCount: buildResult.migratedValueCount,
		updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss'),
	};
}

function buildIstGj2026SheetValues_(planMatrix, existingRealData) {
	const output = [IST_GJ2026_CONFIG.headers.concat(planMatrix.months)];
	const metricOrder = planVodBuildCollapsedMetricOrder_(planMatrix.metricOrder || []);
	const storeIds = (planMatrix.storeIds || []).slice().sort(function(left, right) {
		return String(left).localeCompare(String(right), undefined, { numeric: true });
	});
	const existingMonthIndex = {};
	let migratedValueCount = 0;

	(existingRealData && existingRealData.months ? existingRealData.months : []).forEach(function(month, index) {
		existingMonthIndex[month] = index;
	});

	storeIds.forEach(function(storeId) {
		metricOrder.forEach(function(metric) {
			const rowValues = planMatrix.months.map(function(month) {
				const rawValue = planVodGetExistingMetricValue_(existingRealData, existingMonthIndex, storeId, metric, month);
				if (rawValue === '' || rawValue == null) {
					return '';
				}
				migratedValueCount += 1;
				return rawValue;
			});

			output.push([
				storeId,
				planMatrix.storeNames[storeId] || '',
				metric,
			].concat(rowValues));
		});
	});

	return {
		values: output,
		rowCount: output.length - 1,
		storeCount: storeIds.length,
		metricCount: metricOrder.length,
		migratedValueCount: migratedValueCount,
	};
}

function planGj2026ExtractMetrics_(records) {
	const metricIndex = {};
	Object.keys(records || {}).forEach(function(key) {
		const parts = String(key || '').split('|');
		const metric = parts.length > 1 ? planVodCanonicalizeMetric_(parts[1]) : '';
		if (metric) {
			metricIndex[metric] = true;
		}
	});
	return Object.keys(metricIndex);
}

function createPlanVodOnly() {
	return rebuildPlanVodSheets_({ replaceIstVod: false });
}

function createPlanVodAndReplaceIstVod() {
	return rebuildPlanVodSheets_({ replaceIstVod: true });
}

function rebuildPlanVodSheets_(options) {
	const config = options || {};
	const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
	const planData = getMetricSheetData(SHEET_NAMES.PLAN);
	const storeIds = planVodExtractStoreIds_(planData.records);
	const existingIstVodSheet = spreadsheet.getSheetByName(PLAN_VOD_CONFIG.istVodSheetName)
		|| spreadsheet.getSheetByName(PLAN_VOD_CONFIG.legacyIstVodSheetName);
	const existingIstVodMetricOrder = existingIstVodSheet ? planVodReadMetricOrder_(existingIstVodSheet) : [];
	const metricOrder = planVodBuildMetricOrder_(planData.metricOrder, existingIstVodMetricOrder);
	const output = planVodBuildOutputRows_(planData, metricOrder);

	planVodWriteSheet_(spreadsheet, PLAN_VOD_CONFIG.planVodSheetName, output);

	let replacedIstVod = false;
	let backupSheetName = '';
	if (config.replaceIstVod) {
		backupSheetName = planVodBackupSheet_(spreadsheet, PLAN_VOD_CONFIG.istVodSheetName);
		planVodWriteSheet_(spreadsheet, PLAN_VOD_CONFIG.istVodSheetName, output);
		replacedIstVod = true;
	}

	return {
		createdSheet: PLAN_VOD_CONFIG.planVodSheetName,
		replacedIstVod: replacedIstVod,
		backupSheetName: backupSheetName,
		storeCount: storeIds.length,
		metricCount: metricOrder.length,
		monthCount: planData.months.length,
		rowCount: output.length - 1,
		updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss'),
	};
}

/**
 * Reads a matrix-layout sheet (stores × metrics × months) into a flat records map.
 * Used for PLAN, IST, and VOD sheets.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {{preserveBlanks?:boolean}} [options] - When preserveBlanks is false, empty cells become 0
 * @returns {{months:string[],metricOrder:string[],storeNames:Object,records:Object,presence:Object}}
 */
function planVodReadMatrixSheet_(sheet, options) {
	var config = options || {};
	var preserveBlanks = config.preserveBlanks !== false;
	const values = sheet.getDataRange().getValues();
	if (values.length < 2) {
		throw new Error('Sheet ' + sheet.getName() + ' nemá dáta.');
	}

	const months = values[0].slice(3).filter(function(month) {
		return String(month || '').trim() !== '';
	}).map(function(month) {
		return String(month).trim();
	});

	const storeIds = [];
	const storeNames = {};
	const metricOrder = [];
	const rowsByStoreMetric = {};
	let currentStoreId = '';
	let currentStoreName = '';

	for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
		const row = values[rowIndex];
		if (row[0]) {
			currentStoreId = String(row[0]).trim();
		}
		if (row[1]) {
			currentStoreName = String(row[1]).trim();
		}

		const rawMetric = String(row[2] || '').trim();
		if (!currentStoreId || !rawMetric) {
			continue;
		}

		const metric = planVodCanonicalizeMetric_(rawMetric);
		if (storeIds.indexOf(currentStoreId) === -1) {
			storeIds.push(currentStoreId);
		}
		if (!storeNames[currentStoreId]) {
			storeNames[currentStoreId] = currentStoreName;
		}
		if (metricOrder.indexOf(metric) === -1) {
			metricOrder.push(metric);
		}

		var rawCells = row.slice(3, 3 + months.length);
		rowsByStoreMetric[planVodBuildKey_(currentStoreId, metric)] = preserveBlanks
			? rawCells
			: rawCells.map(function(cell) { return cell === '' || cell == null ? 0 : cell; });
	}

	return {
		months: months,
		storeIds: storeIds,
		storeNames: storeNames,
		metricOrder: metricOrder,
		rowsByStoreMetric: rowsByStoreMetric,
	};
}

function planVodReadMetricOrder_(sheet) {
	const values = sheet.getDataRange().getValues();
	const metricOrder = [];
	for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
		const rawMetric = String(values[rowIndex][2] || '').trim();
		if (!rawMetric) {
			continue;
		}
		const metric = planVodCanonicalizeMetric_(rawMetric);
		if (metricOrder.indexOf(metric) === -1) {
			metricOrder.push(metric);
		}
	}
	return metricOrder;
}

function planVodBuildMetricOrder_(planMetricOrder, existingIstVodMetricOrder) {
	const combined = [];
	PLAN_VOD_CONFIG.preferredMetricOrder
		.concat(existingIstVodMetricOrder || [])
		.concat(planMetricOrder || [])
		.forEach(function(metric) {
			const canonicalMetric = planVodCollapseMetric_(metric);
			if (!canonicalMetric || combined.indexOf(canonicalMetric) > -1) {
				return;
			}
			combined.push(canonicalMetric);
		});
	return combined;
}

function planVodBuildCollapsedMetricOrder_(metricOrder) {
	const collapsed = [];
	(metricOrder || []).forEach(function(metric) {
		const canonicalMetric = planVodCollapseMetric_(metric);
		if (!canonicalMetric || collapsed.indexOf(canonicalMetric) > -1) {
			return;
		}
		collapsed.push(canonicalMetric);
	});
	return collapsed;
}

function planVodBuildOutputRows_(planData, metricOrder) {
	const output = [['Store ID', 'Store Name', 'Metric'].concat(planData.months)];
	const storeIds = planVodExtractStoreIds_(planData.records).sort();

	storeIds.forEach(function(storeId) {
		metricOrder.forEach(function(metric) {
			const values = planData.months.map(function(month) {
				return planVodGetRecordValue_(planData.records, storeId, metric, month);
			});
			output.push([
				storeId,
				planData.storeNames[storeId] || '',
				metric,
			].concat(values));
		});
	});

	return output;
}

function planVodExtractStoreIds_(records) {
	const storeIdIndex = {};
	Object.keys(records || {}).forEach(function(key) {
		const storeId = String(key || '').split('|')[0];
		if (storeId) {
			storeIdIndex[storeId] = true;
		}
	});
	return Object.keys(storeIdIndex);
}

function planVodWriteSheet_(spreadsheet, sheetName, values) {
	let sheet = spreadsheet.getSheetByName(sheetName);
	if (!sheet) {
		sheet = spreadsheet.insertSheet(sheetName);
	}

	sheet.clearContents();
	sheet.getRange(1, 1, values.length, values[0].length).setNumberFormat('@');
	sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
	sheet.setFrozenRows(1);
	sheet.getRange(1, 1, 1, values[0].length)
		.setFontWeight('bold')
		.setBackground('#d71920')
		.setFontColor('#ffffff');
	sheet.autoResizeColumns(1, values[0].length);
}

function planVodBackupSheet_(spreadsheet, sheetName) {
	const sourceSheet = spreadsheet.getSheetByName(sheetName);
	if (!sourceSheet) {
		return '';
	}

	const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
	const backupSheetName = sheetName + '_backup_' + timestamp;
	const backupSheet = spreadsheet.insertSheet(backupSheetName);
	const values = sourceSheet.getDataRange().getValues();
	if (values.length && values[0].length) {
		backupSheet.getRange(1, 1, values.length, values[0].length).setValues(values);
		backupSheet.setFrozenRows(1);
		backupSheet.autoResizeColumns(1, values[0].length);
	}
	return backupSheetName;
}

function planVodGetRequiredSheet_(spreadsheet, sheetName) {
	const sheet = spreadsheet.getSheetByName(sheetName);
	if (!sheet) {
		throw new Error('Sheet ' + sheetName + ' neexistuje.');
	}
	return sheet;
}

function planVodBuildKey_(storeId, metric) {
	return String(storeId || '').trim() + '|' + planVodCanonicalizeMetric_(metric);
}

function planVodGetRecordValue_(records, storeId, metric, month) {
	const canonicalMetric = planVodCanonicalizeMetric_(metric);
	if (!planVodIsShortTermPnMetric_(canonicalMetric)) {
		return getRecordValue_(records, storeId, canonicalMetric, month);
	}

	return getRecordValue_(records, storeId, PLAN_VOD_SHORT_TERM_PN_METRIC, month);
}

function planVodGetExistingMetricValue_(existingData, existingMonthIndex, storeId, metric, month) {
	if (!existingData || !Object.prototype.hasOwnProperty.call(existingMonthIndex, month)) {
		return '';
	}

	const monthIndex = existingMonthIndex[month];
	const canonicalMetric = planVodCanonicalizeMetric_(metric);
	if (!planVodIsShortTermPnMetric_(canonicalMetric)) {
		const existingValues = existingData.rowsByStoreMetric[planVodBuildKey_(storeId, canonicalMetric)];
		return existingValues ? existingValues[monthIndex] : '';
	}

	const directValues = existingData.rowsByStoreMetric[planVodBuildKey_(storeId, PLAN_VOD_SHORT_TERM_PN_METRIC)];
	const directValue = directValues ? directValues[monthIndex] : '';
	if (directValue !== '' && directValue != null) {
		return directValue;
	}

	let hasValue = false;
	const mergedValue = PLAN_VOD_SHORT_TERM_PN_SOURCE_METRICS.reduce(function(sum, sourceMetric) {
		const sourceValues = existingData.rowsByStoreMetric[planVodBuildKey_(storeId, sourceMetric)];
		if (!sourceValues) {
			return sum;
		}
		const rawValue = sourceValues[monthIndex];
		if (rawValue === '' || rawValue == null) {
			return sum;
		}
		hasValue = true;
		return sum + Number(rawValue || 0);
	}, 0);

	return hasValue ? mergedValue : '';
}

function planVodCollapseMetric_(metric) {
	const canonicalMetric = planVodCanonicalizeMetric_(metric);
	if (planVodIsShortTermPnMetric_(canonicalMetric) || PLAN_VOD_SHORT_TERM_PN_SOURCE_METRICS.indexOf(canonicalMetric) > -1) {
		return PLAN_VOD_SHORT_TERM_PN_METRIC;
	}
	return canonicalMetric;
}

function planVodIsShortTermPnMetric_(metric) {
	return planVodCanonicalizeMetric_(metric) === PLAN_VOD_SHORT_TERM_PN_METRIC;
}

function planVodCanonicalizeMetric_(metric) {
	if (typeof canonicalizeMetric_ === 'function') {
		return canonicalizeMetric_(metric);
	}
	return String(metric || '').trim();
}
