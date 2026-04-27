const SHEET_NAMES = {
	LOGIN: 'Login',
	STRUCTURE: 'Struktura',
	PLAN: 'PLANGJ2026',
	VOD: 'ISTVODGJ2026',
	REAL: 'ISTGJ2026',
	WEEKLY_VOD_OVERRIDES: 'WEEKLY_VOD_OVERRIDES',
	NOTES: 'Poznamky',
	SUM_VKL: 'SUM_VKL',
	SUM_GF: 'SUM_GF',
	SUMMARY_CACHE: 'SUMMARY_CACHE',
	VKL_INDEX_CACHE: 'VKL_INDEX_CACHE',
};

const LEGACY_PLAN_STORE_SOURCE_SHEET_NAME = 'Plan2026';
const LEGACY_VOD_SOURCE_SHEET_NAME = 'IstVOD';
const LEGACY_REAL_SOURCE_SHEET_NAME = 'IstReal';
const PLAN_CSV_FOLDER_NAME = 'LogGF_Dane_Struk';
const PLAN_CSV_FILE_PREFIX = 'LogGF_Dane_Struk_';
const GLOBAL_SCOPE_NOTE_METRIC = '__GLOBAL_SCOPE_NOTES__';

const VOD_INPUT_LABEL = 'Uprava VOD';
const DISPLAY_PLAN_LABEL = 'Ročný Plán';
const DISPLAY_REAL_LABEL = 'IST';
const DISPLAY_FORECAST_LABEL = 'Úprava VOD';
const DISPLAY_DELTA_LABEL = 'Δ Delta vs IST';

const SUMMARY_CACHE_HEADERS = [
	'Generated At',
	'Node Id',
	'Node Type',
	'Node Label',
	'Parent Id',
	'Child Ids',
	'Store Count',
	'Metric',
	'Format',
	'Row Type',
	'Row Label',
	'Total',
	'Actual Total',
	'Actual Values',
	'Has Real Flags',
];

const VKL_INDEX_CACHE_HEADERS = [
	'Generated At',
	'VKL',
	'Scope Id',
	'Scope Type',
	'Scope Label',
	'Store Count',
	'Chunk Index',
	'Chunk Count',
	'Payload Chunk',
];

const VKL_INDEX_CACHE_CHUNK_SIZE = 45000;
const VKL_INDEX_CACHE_JOB_PROPERTY = 'VKL_INDEX_CACHE_JOB';
const VKL_INDEX_CACHE_CONTINUATION_HANDLER = 'continueVklIndexCacheBuild_';
const VKL_INDEX_CACHE_TIME_BUDGET_MS = 240000;
const VKL_INDEX_CACHE_CONTINUATION_DELAY_MS = 60 * 1000;

const WEEKLY_VOD_OVERRIDE_HEADERS = [
	'Store ID',
	'Metric',
	'Month',
	'Week Index',
	'Week Label',
	'Range Label',
	'Value',
	'Distribution Mode',
	'Updated At',
	'Updated By',
];

const LOGIN_SHEET_COLUMN_ALIASES = {
	ADMIN_NAME: ['ADMIN'],
	ADMIN_EMAIL: ['ADMIN EMAIL', 'ADMIN E-MAIL'],
	GF_NAME: ['GF'],
	GF_EMAIL: ['GF EMAIL', 'GF E-MAIL'],
	VKL_NAME: ['VKL'],
	VKL_EMAIL: ['VKL EMAIL', 'VKL E-MAIL'],
	STORE_ID: ['VOD', 'STORE', 'STORE ID', 'FILIALKA', 'FILIÁLKA'],
	VOD_IDENTIFIER: ['VOD EMAIL', 'VOD E-MAIL', 'EMAIL VOD', 'VOD LOGIN'],
};

const LOGIN_SHEET_COLUMN_FALLBACKS = {
	GF_NAME: 0,
	GF_EMAIL: 1,
	VKL_NAME: 2,
	VKL_EMAIL: 3,
	STORE_ID: 4,
	VOD_IDENTIFIER: 5,
	ADMIN_NAME: 6,
	ADMIN_EMAIL: 7,
};

const BUSINESS_YEAR_START_MONTH_INDEX = 2;

const MONTH_NAME_TO_INDEX = {
	januar: 0,
	januar: 0,
	'január': 0,
	februar: 1,
	'február': 1,
	marec: 2,
	april: 3,
	'apríl': 3,
	maj: 4,
	jun: 5,
	'jún': 5,
	jul: 6,
	'júl': 6,
	august: 7,
	september: 8,
	oktober: 9,
	'október': 9,
	november: 10,
	december: 11,
};

const STRUCTURE_HOURS_METRIC = 'Štruktúra hodín';
const WORKFORCE_STRUCTURE_METRIC = 'Štruktúra filiálky (plné úväzky)';
const WORKING_DAYS_METRIC = 'Pracovné dni zamestnancov';
const CLOSED_HOLIDAY_METRIC = 'Sviatok zatvorené';
const LONG_ABSENCE_METRIC = 'Dlhodobá neprítomnosť (33+ dní) (b)';
const GROSS_HOURS_METRIC = 'Hodiny Brutto GJ2026';
const OBRAT_METRIC = 'Obrat GJ2026';
const NET_HOURS_METRIC = 'Hodiny netto';
const CLEAN_PERFORMANCE_METRIC = 'Čistý výkon';
const NET_HOURS_PLAN_VT_METRIC = 'Hodiny netto Plan VT';
const NET_HOURS_2024_METRIC = 'Hodiny netto 2024';
const VACATION_METRIC = 'Dovolenka (-)';
const SHORT_PN_METRIC = 'PN (< 10 dní) (-)';
const OTHER_ABSENCE_METRIC = 'Iné (napr. uvoľ z práce, OČR, odber krvi,(-)';
const SHORT_TERM_PN_METRIC = 'PN Krátkodobé';
const SHORT_TERM_PN_SOURCE_METRICS = [SHORT_PN_METRIC, OTHER_ABSENCE_METRIC];
const AGREEMENT_METRIC = 'Odmena za dohodu';
const AGENCY_CLEANING_METRIC = 'Externá pracovná agentúra (+) Reinigung';
const AGENCY_STOCKING_METRIC = 'Externá pracovná agentúra (+) Wareneinräumung';
const STUDENT_BONUS_METRIC = 'Odmena za pr.prácu žiak (+) 50%';
const OVERTIME_METRIC = 'Nadčasy (+)';
const SALDO_PLUS_METRIC = 'Saldo DF (+)';
const SALDO_MINUS_METRIC = 'Saldo DF (-)';
const HOLIDAY_PAY_METRIC = 'Plat sviatky';
const FIMA_METRIC = 'FiMa/Prestavba/Dodatočné práce/NEO';
const INVENTORY_METRIC = 'Inventúra (+)';
const FULL_TIME_DAILY_HOURS = 7.75;

const HARDCODED_WORKING_DAYS_BY_MONTH = {
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

const HARDCODED_CLOSED_HOLIDAYS_BY_MONTH = {
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

const HARDCODED_WORKING_DAYS_FALLBACK = [22, 21, 21, 22, 23, 21, 22, 22, 21, 21, 20, 20];
const HARDCODED_CLOSED_HOLIDAYS_FALLBACK = [0, 1, 0, 0, 0, 0, 0, 0, 0, 2, 1, 0];

const REQUIRED_DERIVED_METRICS = [
	CLEAN_PERFORMANCE_METRIC,
	OBRAT_METRIC,
	NET_HOURS_METRIC,
	WORKING_DAYS_METRIC,
	CLOSED_HOLIDAY_METRIC,
	WORKFORCE_STRUCTURE_METRIC,
	STRUCTURE_HOURS_METRIC,
	LONG_ABSENCE_METRIC,
	GROSS_HOURS_METRIC,
];

const HIDDEN_TABLE_METRICS = [
	WORKING_DAYS_METRIC,
	CLOSED_HOLIDAY_METRIC,
	STRUCTURE_HOURS_METRIC,
];

const UI_METRIC_ORDER = [
	WORKFORCE_STRUCTURE_METRIC,
	LONG_ABSENCE_METRIC,
	GROSS_HOURS_METRIC,
	WORKING_DAYS_METRIC,
	CLOSED_HOLIDAY_METRIC,
	NET_HOURS_2024_METRIC,
	STRUCTURE_HOURS_METRIC,
	AGREEMENT_METRIC,
	AGENCY_CLEANING_METRIC,
	AGENCY_STOCKING_METRIC,
	SHORT_TERM_PN_METRIC,
	STUDENT_BONUS_METRIC,
	OVERTIME_METRIC,
	SALDO_PLUS_METRIC,
	SALDO_MINUS_METRIC,
	VACATION_METRIC,
	HOLIDAY_PAY_METRIC,
	FIMA_METRIC,
	NET_HOURS_METRIC,
	OBRAT_METRIC,
	CLEAN_PERFORMANCE_METRIC,
];

const PRIMARY_METRICS = [
	CLEAN_PERFORMANCE_METRIC,
	OBRAT_METRIC,
	NET_HOURS_METRIC,
	VACATION_METRIC,
	STRUCTURE_HOURS_METRIC,
];

const SUMMARY_METRICS = [
	OBRAT_METRIC,
	NET_HOURS_METRIC,
	STRUCTURE_HOURS_METRIC,
	CLEAN_PERFORMANCE_METRIC,
];

const STRUCTURE_DRIVEN_METRICS = [STRUCTURE_HOURS_METRIC, WORKFORCE_STRUCTURE_METRIC];

const WORKFORCE_STRUCTURE_BANDS = [
	{ key: 'Štruktúra filiálky 100%', label: '100%', fteWeight: 1, hoursWeight: 7.75 },
	{ key: 'Štruktúra filiálky 90%', label: '90%', fteWeight: 0.9, hoursWeight: 7 },
	{ key: 'Štruktúra filiálky 77%', label: '77%', fteWeight: 0.77, hoursWeight: 6 },
	{ key: 'Štruktúra filiálky 65%', label: '65%', fteWeight: 0.65, hoursWeight: 5 },
	{ key: 'Štruktúra filiálky 52%', label: '52%', fteWeight: 0.52, hoursWeight: 4 },
	{ key: 'Štruktúra filiálky 39%', label: '39%', fteWeight: 0.39, hoursWeight: 3 },
];

const LONG_ABSENCE_WORKFORCE_BANDS = WORKFORCE_STRUCTURE_BANDS.map(function(band) {
	return {
		key: 'Dlhodobá neprítomnosť ' + band.label,
		label: band.label,
		fteWeight: band.fteWeight,
		hoursWeight: band.hoursWeight,
	};
});

const NET_HOURS_COMPONENT_METRICS = [
	STRUCTURE_HOURS_METRIC,
	LONG_ABSENCE_METRIC,
	VACATION_METRIC,
	SHORT_TERM_PN_METRIC,
	AGREEMENT_METRIC,
	AGENCY_CLEANING_METRIC,
	AGENCY_STOCKING_METRIC,
	STUDENT_BONUS_METRIC,
	OVERTIME_METRIC,
	SALDO_PLUS_METRIC,
	SALDO_MINUS_METRIC,
	HOLIDAY_PAY_METRIC,
];

const EXCLUDED_METRICS = [
	INVENTORY_METRIC,
	WORKFORCE_STRUCTURE_METRIC,
	NET_HOURS_PLAN_VT_METRIC,
	'Hodiny netto vs Netto Plan VT Δ h',
];

const PLAN_AS_PENDING_DELTA_METRICS = [
	LONG_ABSENCE_METRIC,
	AGENCY_CLEANING_METRIC,
	AGENCY_STOCKING_METRIC,
	SHORT_TERM_PN_METRIC,
	STUDENT_BONUS_METRIC,
	OVERTIME_METRIC,
	SALDO_PLUS_METRIC,
	SALDO_MINUS_METRIC,
	VACATION_METRIC,
	FIMA_METRIC,
	NET_HOURS_METRIC,
	OBRAT_METRIC,
	CLEAN_PERFORMANCE_METRIC,
];

const METRIC_ALIASES = {
	[OBRAT_METRIC]: ['Obrat GJ2026'],
	[WORKING_DAYS_METRIC]: ['Pracovné dni zamestnancov', 'Pracovne dni zamestnancov'],
	[CLOSED_HOLIDAY_METRIC]: ['Sviatok zatvorené', 'Sviatok zatvorene', 'Sviatok otvorené', 'Sviatok otvorene'],
	[LONG_ABSENCE_METRIC]: [
		'Dlhodobá neprítomnosť (33+ dní) (b)',
		'Dlhodoba nepritomnost (33+ dni) (b)',
		'Dlhodobá neprítomnosť (33+dní) (b)',
		'Dlhodoba nepritomnost (33+dni) (b)',
		'Dlhodobá neprítomnosť (33>dní) (b)',
		'Dlhodoba nepritomnost (33>dni) (b)',
		'Dlhodobá neprítomnosť (33 dní) (b)',
		'Dlhodoba nepritomnost (33 dni) (b)',
		'Dlhodobá neprítomnosť (33-dní) (b)',
		'Dlhodoba nepritomnost (33-dni) (b)',
		'Dlhodobá neprítomnosť (33 dni) b',
		'Dlhodoba nepritomnost (33 dni) b',
		'Dlhodobá neprítomnosť (53+ dní) (b)',
		'Dlhodoba nepritomnost (53+ dni) (b)',
		'Dlhodobá neprítomnosť',
		'Dlhodoba nepritomnost'
	],
	[GROSS_HOURS_METRIC]: ['Hodiny Brutto GJ2026'],
	[AGREEMENT_METRIC]: ['Odmena za dohodu', 'Odmena za dohodu (+)', 'Odmena za dohodu (-)', 'Odmena zo dohodou (+)', 'Odmena zo dohodou (-)', 'Odmena zo dohôd (+)', 'Odmena zo dohôd (-)'],
	[NET_HOURS_METRIC]: ['Hodiny netto', 'N/A', '#N/A'],
	[NET_HOURS_2024_METRIC]: ['Hodiny netto 2024'],
	[NET_HOURS_PLAN_VT_METRIC]: ['Hodiny netto Plan VT', 'Hodiny netto VT', 'Hodiny netto Plan V T'],
	'Hodiny netto vs Netto Plan VT Δ h': ['Hodiny netto vs Netto Plan VT Δ h', 'Hodiny netto vs Netto Plan VT A h', 'Hodiny netto vs Netto Plan VT Δh'],
	[CLEAN_PERFORMANCE_METRIC]: ['Čistý výkon', 'Cisty vykon'],
	[VACATION_METRIC]: ['Dovolenka (-)'],
	[SHORT_TERM_PN_METRIC]: ['PN Krátkodobé', 'PN Kratkodobe'],
	[STUDENT_BONUS_METRIC]: ['Odmena za pr.prácu žiak (+) 50%', 'Odmena za pr.pracu ziak (+) 50%'],
	[OVERTIME_METRIC]: ['Nadčasy (+)', 'Nadcasy (+)'],
	[OTHER_ABSENCE_METRIC]: ['Iné (napr. uvoľ z práce, OČR, odber krvi,(-)', 'Ine (napr. uvol z prace, OCR, odber krvi,(-)'],
	[SHORT_PN_METRIC]: ['PN (< 10 dní) (-)', 'PN (< 10 dni) (-)'],
	[AGENCY_CLEANING_METRIC]: ['Externá pracovná agentúra (+) Reinigung', 'Externa pracovna agentura (+) Reinigung'],
	[AGENCY_STOCKING_METRIC]: ['Externá pracovná agentúra (+) Wareneinräumung', 'Externa pracovna agentura (+) Wareneinraumung', 'Externá pracovná agentúra (+) Wareneinraumen'],
	[FIMA_METRIC]: ['FiMa/Prestavba/Dodatočné práce/NEO', 'FiMa/Prestavba/Dodatocne prace/NEO'],
	[SALDO_MINUS_METRIC]: ['Saldo DF (-)'],
	[SALDO_PLUS_METRIC]: ['Saldo DF (+)'],
	[HOLIDAY_PAY_METRIC]: ['Plat sviatky'],
	[STRUCTURE_HOURS_METRIC]: ['Štruktúra hodín', 'Struktura hodin'],
	[WORKFORCE_STRUCTURE_METRIC]: ['Štruktúra filiálky (plné úväzky)', 'Štruktúra filiálky (plné úvazky)', 'Struktura filialky (plne uvazky)', 'Struktura filialky (plne uvazky)'],
	'Dlhodobá neprítomnosť 100%': ['Dlhodobá neprítomnosť 100%'],
	'Dlhodobá neprítomnosť 90%': ['Dlhodobá neprítomnosť 90%'],
	'Dlhodobá neprítomnosť 77%': ['Dlhodobá neprítomnosť 77%'],
	'Dlhodobá neprítomnosť 65%': ['Dlhodobá neprítomnosť 65%'],
	'Dlhodobá neprítomnosť 52%': ['Dlhodobá neprítomnosť 52%'],
	'Dlhodobá neprítomnosť 39%': ['Dlhodobá neprítomnosť 39%'],
};

function onOpen() {
	SpreadsheetApp.getUi()
		.createMenu('PRO Dashboard')
		.addItem('Rebuild PLANGJ2026 From CSV', 'createPlanGj2026SheetFromCsv')
		.addItem('Rebuild ISTGJ2026 From PLANGJ2026', 'createIstGj2026SheetFromPlan')
		.addItem('Rebuild Summary Cache', 'createSummaryCache')
		.addItem('Rebuild VKL Index Cache', 'createVklIndexCache')
		.addToUi();
}

/**
 * Web-app entry point. Routes to Index.html (VOD dashboard) or sumar.html (summary view).
 * @param {GoogleAppsScript.Events.DoGet} event - URL parameters (?view=sumar)
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet(event) {
	const view = event && event.parameter ? String(event.parameter.view || '').trim().toLowerCase() : '';
	if (view === 'test') {
		return HtmlService.createHtmlOutputFromFile('test')
			.setTitle('PRO Test Lab');
	}
	const fileName = view === 'sumar' ? 'sumar' : 'Index';
	const title = view === 'sumar' ? 'Kaufland PRO Summary' : 'Kaufland PRO Dashboard';
	const template = HtmlService.createTemplateFromFile(fileName);
	return template.evaluate()
		.setTitle(title);
}

/** @param {string} filename - HTML partial name (without extension) */
function include(filename) {
	return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getDashboardData(loginValue, selectedScope) {
	const structure = getStructureData();
	const user = authenticateUser(loginValue, { context: 'dashboard', structure: structure });
	const structureStoreNames = getStructureStoreNames_();
	const scope = resolveScope(user, selectedScope, structure, structureStoreNames);
	const cachedContent = user.role === 'VKL'
		? getVklIndexCacheContent_(user.vklName, scope.id)
		: null;

	if (cachedContent) {
		return buildDashboardResponseFromContent_(cachedContent, user, scope, structure, structureStoreNames);
	}

	const liveStoreFilter = scope.type === 'STORE' ? scope.storeIds.slice() : null;
	const planData = getMetricSheetData(SHEET_NAMES.PLAN, { storeIds: liveStoreFilter });
	const realData = getMetricSheetData(SHEET_NAMES.REAL, { storeIds: liveStoreFilter });
	const vodData = getMetricSheetData(SHEET_NAMES.VOD, { storeIds: liveStoreFilter });
	const liveContent = buildDashboardContentPayload_(
		scope,
		planData,
		realData,
		vodData,
		Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm')
	);

	return buildDashboardResponseFromContent_(
		liveContent,
		user,
		scope,
		structure,
		Object.assign({}, structureStoreNames, planData.storeNames)
	);
}

function buildDashboardContentPayload_(scope, planData, realData, vodData, generatedAt) {
	const months = planData.months;
	const storeDatasets = scope && scope.precomputedStoreDatasets ? scope.precomputedStoreDatasets : null;
	const dataset = scope && scope.precomputedDataset
		? scope.precomputedDataset
		: buildScopeDataset(scope.storeIds, months, planData, realData, vodData);

	return {
		generatedAt: generatedAt,
		months: months,
		cards: buildCards(dataset, months),
		charts: buildCharts(dataset, months),
		table: buildTable(dataset, months, scope, planData, realData, vodData, storeDatasets),
		stores: buildStoreSummary(scope.storeIds, months, planData, realData, vodData, storeDatasets),
	};
}

function buildDashboardResponseFromContent_(content, user, scope, structure, storeNames) {
	const noteScope = buildNoteScope_(user, scope);
	return {
		generatedAt: content.generatedAt,
		user: user,
		scope: {
			id: scope.id,
			label: scope.label,
			type: scope.type,
			storeIds: scope.storeIds,
			noteScopeKey: noteScope.key,
		},
		scopes: buildAvailableScopes(user, structure, storeNames || {}),
		months: content.months,
		cards: content.cards,
		charts: content.charts,
		table: content.table,
		stores: content.stores,
	};
}

function getWeeklyVodOverrides(loginValue, selectedScope, monthLabel) {
	const user = authenticateUser(loginValue, { context: 'dashboard' });
	const structure = getStructureData();
	const structureStoreNames = getStructureStoreNames_();
	const scope = resolveScope(user, selectedScope, structure, structureStoreNames);
	const normalizedMonth = normalizeSheetMonthLabel_(monthLabel);

	if (!normalizedMonth || !scope.storeIds || !scope.storeIds.length) {
		return {
			scopeId: scope.id,
			month: normalizedMonth,
			overrides: {},
			storeOverrides: {},
		};
	}

	const overridePayload = readWeeklyVodOverridePayloadForStores_(scope.storeIds, normalizedMonth);

	return {
		scopeId: scope.id,
		month: normalizedMonth,
		overrides: overridePayload.overrides,
		storeOverrides: overridePayload.storeOverrides,
	};
}

function getSummaryData(loginValue) {
	const structure = getStructureData();
	const user = String(loginValue || '').trim()
		? authenticateUser(loginValue, { context: 'summary', structure: structure })
		: null;
	const summaryData = getSummaryCacheData_(structure) || buildLiveSummaryHierarchyData_(structure);
	const allStoreIds = Object.keys(structure.storeToHierarchy).sort();

	return {
		generatedAt: summaryData.generatedAt,
		user: user ? {
			role: user.role,
			displayName: user.displayName,
			email: user.email,
		} : null,
		gfCount: structure.gfs.length,
		vklCount: structure.vkls.length,
		storeCount: allStoreIds.length,
		months: summaryData.months,
		metrics: summaryData.metrics,
		hierarchy: summaryData.hierarchy,
		defaultNodeId: summaryData.hierarchy.rootId,
		defaultMonth: getSuggestedSummaryMonth_(summaryData.months),
	};
}

function createSummaryCache() {
	const structure = getStructureData();
	const sourceSheets = getSummarySourceSheets_();
	notifySummaryBuildProgress_('Summary cache: spustam rebuild z ' + sourceSheets.plan + ' / ' + sourceSheets.real + ' / ' + sourceSheets.vod + '.');
	const summaryData = buildLiveSummaryHierarchyData_(structure);
	const cacheResult = writeSummaryCache_(summaryData.hierarchy, summaryData.months, summaryData.generatedAt);
	notifySummaryBuildProgress_('Summary cache hotova: ' + cacheResult.rows + ' riadkov, ' + cacheResult.nodeCount + ' uzlov.');

	return {
		cacheRows: cacheResult.rows,
		nodeCount: cacheResult.nodeCount,
		generatedAt: cacheResult.generatedAt,
		sourceSheets: sourceSheets,
	};
}

function createVklIndexCache() {
	const sourceSheets = getVklIndexCacheSourceSheets_();
	clearVklIndexCacheContinuationTriggers_();
	resetVklIndexCacheSheet_();
	setVklIndexCacheJobState_({
		generatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm'),
		nextIndex: 0,
		scopeCount: 0,
		rowCount: 0,
	});
	notifyVklIndexCacheProgress_('VKL cache: spustam rebuild z ' + sourceSheets.plan + ' / ' + sourceSheets.real + ' / ' + sourceSheets.vod + '.');
	const result = continueVklIndexCacheBuild_();
	result.sourceSheets = sourceSheets;
	return result;
}

function continueVklIndexCacheBuild_() {
	return withVklIndexCacheJobLock_(function() {
		const sourceSheets = getVklIndexCacheSourceSheets_();
		const state = getVklIndexCacheJobState_();
		if (!state) {
			clearVklIndexCacheContinuationTriggers_();
			return {
				status: 'idle',
				message: 'VKL index cache job nie je inicializovaný.',
				sourceSheets: sourceSheets,
			};
		}

		const structure = getStructureData();
		const sortedVkls = structure.vkls.slice().sort();
		if (state.nextIndex >= sortedVkls.length) {
			clearVklIndexCacheJobState_();
			clearVklIndexCacheContinuationTriggers_();
			const completedResult = {
				status: 'completed',
				vklCount: sortedVkls.length,
				scopeCount: state.scopeCount,
				rows: state.rowCount,
				generatedAt: state.generatedAt,
				sourceSheets: sourceSheets,
			};
			notifyVklIndexCacheProgress_('VKL cache hotova: ' + completedResult.vklCount + ' VKL, ' + completedResult.rows + ' riadkov cache.');
			return completedResult;
		}

		const planData = getMetricSheetData(SHEET_NAMES.PLAN);
		const realData = getMetricSheetData(SHEET_NAMES.REAL);
		const vodData = getMetricSheetData(SHEET_NAMES.VOD);
		const cacheRows = [];
		const vklName = sortedVkls[state.nextIndex];
		const storeIds = (structure.vklToStores[vklName] || []).slice().sort();
		state.nextIndex += 1;

		if (storeIds.length) {
			const precomputedStoreDatasets = {};
			storeIds.forEach(function(storeId) {
				precomputedStoreDatasets[storeId] = buildScopeDataset([storeId], planData.months, planData, realData, vodData);
			});
			const precomputedAggregateDataset = buildScopeDataset(storeIds, planData.months, planData, realData, vodData);

			const availableScopes = buildAvailableScopes({
				role: 'VKL',
				accessibleStoreIds: storeIds,
			}, structure, planData.storeNames);

			availableScopes.forEach(function(scopeOption) {
				const scope = scopeOption.type === 'STORE'
					? {
						id: scopeOption.id,
						type: 'STORE',
						label: scopeOption.label,
						storeIds: [scopeOption.id],
						precomputedDataset: precomputedStoreDatasets[scopeOption.id] || null,
						precomputedStoreDatasets: precomputedStoreDatasets,
					}
					: {
						id: scopeOption.id,
						type: 'AGGREGATE',
						label: scopeOption.label,
						storeIds: storeIds.slice(),
						precomputedDataset: precomputedAggregateDataset,
						precomputedStoreDatasets: precomputedStoreDatasets,
					};
				const content = buildDashboardContentPayload_(scope, planData, realData, vodData, state.generatedAt);
				const scopeRows = buildVklIndexCacheRowsForScope_(vklName, scope, content);
				Array.prototype.push.apply(cacheRows, scopeRows);
				state.scopeCount += 1;
				state.rowCount += scopeRows.length;
			});
		}

		if (cacheRows.length) {
			appendRowsToSheet_(SHEET_NAMES.VKL_INDEX_CACHE, VKL_INDEX_CACHE_HEADERS, cacheRows);
		}

		if (state.nextIndex >= sortedVkls.length) {
			clearVklIndexCacheJobState_();
			clearVklIndexCacheContinuationTriggers_();
			const completedResult = {
				status: 'completed',
				vklCount: sortedVkls.length,
				scopeCount: state.scopeCount,
				rows: state.rowCount,
				generatedAt: state.generatedAt,
				sourceSheets: sourceSheets,
			};
			notifyVklIndexCacheProgress_('VKL cache hotova: ' + completedResult.vklCount + ' VKL, ' + completedResult.rows + ' riadkov cache.');
			return completedResult;
		}

		setVklIndexCacheJobState_(state);
		scheduleVklIndexCacheContinuation_();
		const scheduledResult = {
			status: 'scheduled',
			processedVkls: 1,
			currentVkl: vklName,
			completedVkls: state.nextIndex,
			remainingVkls: Math.max(0, sortedVkls.length - state.nextIndex),
			scopeCount: state.scopeCount,
			rows: state.rowCount,
			generatedAt: state.generatedAt,
			sourceSheets: sourceSheets,
		};
		notifyVklIndexCacheProgress_('VKL cache: spracovane ' + scheduledResult.completedVkls + '/' + sortedVkls.length + ' (' + vklName + '), pokracovanie je naplanovane.');
		return scheduledResult;
	});
}

function getWebAppUrl() {
	return ScriptApp.getService().getUrl() || '';
}

/**
 * Persists VOD adjustment edits and notes back to the spreadsheet.
 * @param {string} loginValue - User login identifier
 * @param {string} selectedScope - Scope key (store/region/area)
 * @param {Array<{metric:string,month:string,value:number}>} adjustmentUpdates
 * @param {Array<{metric:string,text:string}>} noteUpdates
 * @returns {{savedAdjustments:number,savedNotes:number,updatedAt:string}}
 */
function saveDashboardChanges(loginValue, selectedScope, adjustmentUpdates, noteUpdates, weeklyAdjustmentUpdates) {
	const user = authenticateUser(loginValue, { context: 'dashboard' });
	const structure = getStructureData();
	const planData = getMetricSheetData(SHEET_NAMES.PLAN);
	const scope = resolveScope(user, selectedScope, structure, planData.storeNames);

	return withDashboardWriteLock_(function() {
		const result = {
			savedAdjustments: 0,
			savedWeeklyAdjustments: 0,
			savedNotes: 0,
			updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss'),
		};

		if (adjustmentUpdates && adjustmentUpdates.length) {
			result.savedAdjustments = saveVodAdjustments_(user, scope.storeIds[0], adjustmentUpdates, planData).saved;
			result.savedWeeklyAdjustments = saveWeeklyVodOverrides_(user, scope.storeIds[0], adjustmentUpdates, weeklyAdjustmentUpdates).saved;
		} else if (weeklyAdjustmentUpdates && weeklyAdjustmentUpdates.length) {
			result.savedWeeklyAdjustments = saveWeeklyVodOverrides_(user, scope.storeIds[0], [], weeklyAdjustmentUpdates).saved;
		}

		if (noteUpdates && noteUpdates.length) {
			result.savedNotes = saveMetricNotes_(user, scope, noteUpdates).saved;
		}

		return result;
	});
}

function withDashboardWriteLock_(callback) {
	const lock = LockService.getDocumentLock();
	let hasLock = false;
	try {
		lock.waitLock(30000);
		hasLock = true;
	} catch (error) {
		throw new Error('Prebieha iny zapis dashboardu. Pockajte chvilu a skuste ulozit znovu.');
	}
	try {
		return callback();
	} finally {
		if (hasLock) {
			lock.releaseLock();
		}
	}
}

function buildSummaryUnit_(scope, metrics, months, planData, realData, vodData) {
	const dataset = buildScopeDataset(scope.storeIds, months, planData, realData, vodData);
	return buildSummaryUnitFromDataset_(scope, dataset, months, metrics);
}

function buildSummaryUnitFromDataset_(scope, dataset, months, metrics) {
	const turnoverRow = getMetricRow_(dataset.rows, OBRAT_METRIC, months);
	const hoursRow = getMetricRow_(dataset.rows, NET_HOURS_METRIC, months);
	const performanceRow = getMetricRow_(dataset.rows, CLEAN_PERFORMANCE_METRIC, months);

	return {
		id: scope.id,
		type: scope.type,
		label: scope.label,
		storeCount: scope.storeIds.length,
		metrics: buildSummaryMetrics_(dataset, months, metrics),
		charts: {
			turnover: buildChartSeries_(turnoverRow, months, 'currency'),
			hours: buildChartSeries_(hoursRow, months, 'hours'),
			performance: buildChartSeries_(performanceRow, months, 'number'),
		},
	};
}

function buildSummaryHierarchy_(structure, metrics, months, planData, realData, vodData) {
	const nodes = {};
	const sortedGfs = structure.gfs.slice().sort();
	const sortedVkls = structure.vkls.slice().sort();
	const allStoreIds = Object.keys(structure.storeToHierarchy).sort();
	const rootId = 'COUNTRY|SK';

	allStoreIds.forEach(function(storeId) {
		const dataset = buildScopeDataset([storeId], months, planData, realData, vodData);
		const hierarchyInfo = structure.storeToHierarchy[storeId] || {};
		const node = buildSummaryUnitFromDataset_({
			id: 'STORE|' + storeId,
			type: 'STORE',
			label: buildStoreDisplayLabel_(storeId, planData.storeNames[storeId]),
			storeIds: [storeId],
		}, dataset, months, metrics);
		node.parentId = hierarchyInfo.vkl ? 'VKL|' + hierarchyInfo.vkl : '';
		node.childIds = [];
		nodes[node.id] = node;
	});

	sortedVkls.forEach(function(vklName) {
		const storeIds = (structure.vklToStores[vklName] || []).slice().sort();
		const childNodes = storeIds.map(function(storeId) {
			return nodes['STORE|' + storeId];
		}).filter(Boolean);
		const node = buildAggregatedSummaryNode_({
			id: 'VKL|' + vklName,
			type: 'VKL',
			label: 'VKL ' + vklName + ' • GF ' + (structure.vklToGf[vklName] || '-'),
			storeIds: storeIds,
		}, childNodes, months);
		node.parentId = structure.vklToGf[vklName] ? 'GF|' + structure.vklToGf[vklName] : rootId;
		node.childIds = storeIds.map(function(storeId) {
			return 'STORE|' + storeId;
		});
		nodes[node.id] = node;
	});

	sortedGfs.forEach(function(gfName) {
		const storeIds = (structure.gfToStores[gfName] || []).slice().sort();
		const childNodes = sortedVkls.filter(function(vklName) {
			return structure.vklToGf[vklName] === gfName;
		}).map(function(vklName) {
			return nodes['VKL|' + vklName];
		}).filter(Boolean);
		const node = buildAggregatedSummaryNode_({
			id: 'GF|' + gfName,
			type: 'GF',
			label: 'GF ' + gfName,
			storeIds: storeIds,
		}, childNodes, months);
		node.parentId = rootId;
		node.childIds = sortedVkls.filter(function(vklName) {
			return structure.vklToGf[vklName] === gfName;
		}).map(function(vklName) {
			return 'VKL|' + vklName;
		});
		nodes[node.id] = node;
	});

	const rootNode = buildAggregatedSummaryNode_({
		id: rootId,
		type: 'GLOBAL',
		label: 'Celé Slovensko',
		storeIds: allStoreIds,
	}, sortedGfs.map(function(gfName) {
		return nodes['GF|' + gfName];
	}).filter(Boolean), months);
	rootNode.parentId = '';
	rootNode.childIds = sortedGfs.map(function(gfName) {
		return 'GF|' + gfName;
	});
	nodes[rootId] = rootNode;

	return {
		rootId: rootId,
		nodes: nodes,
	};
}

function buildLiveSummaryHierarchyData_(structure) {
	const planData = getMetricSheetData(SHEET_NAMES.PLAN);
	const realData = getMetricSheetData(SHEET_NAMES.REAL);
	const vodData = getMetricSheetData(SHEET_NAMES.VOD);
	const months = planData.months;
	const metrics = SUMMARY_METRICS.slice();

	return {
		generatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm'),
		months: months,
		metrics: metrics,
		hierarchy: buildSummaryHierarchy_(structure, metrics, months, planData, realData, vodData),
	};
}

function getSummaryCacheData_(structure) {
	const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.SUMMARY_CACHE);
	if (!sheet || sheet.getLastRow() < 2) {
		return null;
	}

	const values = sheet.getDataRange().getValues();
	if (!isSummaryCacheHeaderCompatible_(values[0] || [])) {
		return null;
	}
	const months = values[0].slice(SUMMARY_CACHE_HEADERS.length).map(function(month) {
		return normalizeSheetMonthLabel_(month);
	}).filter(Boolean);
	if (!months.length) {
		return null;
	}

	const nodes = {};
	let rootId = '';
	let generatedAt = '';

	for (let row = 1; row < values.length; row += 1) {
		const generatedAtValue = String(values[row][0] || '').trim();
		const nodeId = String(values[row][1] || '').trim();
		const nodeType = String(values[row][2] || '').trim();
		const nodeLabel = String(values[row][3] || '').trim();
		const parentId = String(values[row][4] || '').trim();
		const childIds = parseSummaryCacheChildIds_(values[row][5]);
		const storeCount = Number(values[row][6] || 0);
		const metric = String(values[row][7] || '').trim();
		const format = String(values[row][8] || '').trim() || getMetricFormat_(metric);
		const rowType = String(values[row][9] || '').trim();
		const rowLabel = String(values[row][10] || '').trim();
		const total = Number(values[row][11] || 0);
		const actualTotal = Number(values[row][12] || 0);
		const actualValues = parseSummaryCacheJsonArray_(values[row][13]);
		const hasRealFlags = parseSummaryCacheJsonBooleanArray_(values[row][14]);

		if (!nodeId) {
			continue;
		}

		if (!generatedAt && generatedAtValue) {
			generatedAt = generatedAtValue;
		}

		if (!nodes[nodeId]) {
			const storeId = nodeType === 'STORE' ? String(nodeId.split('|')[1] || '').trim() : '';
			nodes[nodeId] = {
				id: nodeId,
				type: nodeType,
				label: nodeType === 'STORE' ? buildStoreDisplayLabel_(storeId, nodeLabel) : nodeLabel,
				parentId: parentId,
				childIds: childIds,
				storeCount: storeCount,
				metrics: [],
				metricMap: {},
			};
		}

		if (!rootId && !parentId) {
			rootId = nodeId;
		}

		if (!metric || !rowType) {
			continue;
		}

		const canonicalMetric = canonicalizeMetric_(metric);
		if (!nodes[nodeId].metricMap[canonicalMetric]) {
			nodes[nodeId].metricMap[canonicalMetric] = {
				metric: canonicalMetric,
				format: format,
				rows: [],
			};
		}

		nodes[nodeId].metricMap[canonicalMetric].rows.push({
			type: rowType,
			label: rowLabel || rowType,
			values: months.map(function(month, monthIndex) {
				return Number(values[row][SUMMARY_CACHE_HEADERS.length + monthIndex] || 0);
			}),
			total: total,
			actualTotal: actualTotal,
			actualValues: actualValues,
			hasRealFlags: hasRealFlags,
		});
	}

	if (!rootId || !nodes[rootId]) {
		return null;
	}

	Object.keys(nodes).forEach(function(nodeId) {
		const node = nodes[nodeId];
		node.metrics = SUMMARY_METRICS.map(function(metric) {
			return node.metricMap[canonicalizeMetric_(metric)] || null;
		}).filter(Boolean);
		node.charts = buildSummaryChartsFromMetricSections_(node.metrics);
		delete node.metricMap;
	});

	const summaryData = {
		generatedAt: generatedAt || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm'),
		months: months,
		metrics: SUMMARY_METRICS.slice(),
		hierarchy: {
			rootId: rootId,
			nodes: nodes,
		},
	};

	return isSummaryCacheCompatible_(summaryData, structure) ? summaryData : null;
}

function isSummaryCacheHeaderCompatible_(headerRow) {
	if (!Array.isArray(headerRow) || headerRow.length < SUMMARY_CACHE_HEADERS.length) {
		return false;
	}

	return SUMMARY_CACHE_HEADERS.every(function(expectedHeader, index) {
		return String(headerRow[index] || '').trim() === expectedHeader;
	});
}

function parseSummaryCacheJsonArray_(value) {
	const text = String(value == null ? '' : value).trim();
	if (!text) {
		return [];
	}

	try {
		const parsed = JSON.parse(text);
		return Array.isArray(parsed)
			? parsed.map(function(item) { return Number(item || 0); })
			: [];
	} catch (error) {
		return [];
	}
}

function parseSummaryCacheJsonBooleanArray_(value) {
	const text = String(value == null ? '' : value).trim();
	if (!text) {
		return [];
	}

	try {
		const parsed = JSON.parse(text);
		return Array.isArray(parsed)
			? parsed.map(function(item) { return Boolean(item); })
			: [];
	} catch (error) {
		return [];
	}
}

function getVklIndexCacheContent_(vklName, scopeId) {
	const normalizedVkl = String(vklName || '').trim();
	const normalizedScopeId = String(scopeId || '').trim();
	if (!normalizedVkl || !normalizedScopeId) {
		return null;
	}

	const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.VKL_INDEX_CACHE);
	if (!sheet || sheet.getLastRow() < 2) {
		return null;
	}

	const values = sheet.getDataRange().getValues();
	if (!isVklIndexCacheHeaderCompatible_(values[0] || [])) {
		return null;
	}

	const chunks = [];
	let expectedChunkCount = 0;
	let generatedAt = '';

	for (let row = 1; row < values.length; row += 1) {
		const rowVklName = String(values[row][1] || '').trim();
		const rowScopeId = String(values[row][2] || '').trim();
		if (rowVklName !== normalizedVkl || rowScopeId !== normalizedScopeId) {
			continue;
		}

		chunks.push({
			index: Math.max(0, Number(values[row][6] || 0)),
			value: String(values[row][8] || ''),
		});
		if (!expectedChunkCount) {
			expectedChunkCount = Math.max(0, Number(values[row][7] || 0));
		}
		if (!generatedAt) {
			generatedAt = String(values[row][0] || '').trim();
		}
	}

	if (!chunks.length || (expectedChunkCount && chunks.length !== expectedChunkCount)) {
		return null;
	}

	chunks.sort(function(left, right) {
		return left.index - right.index;
	});

	if (expectedChunkCount && chunks.some(function(chunk, index) {
		return chunk.index !== index;
	})) {
		return null;
	}

	try {
		const parsed = JSON.parse(chunks.map(function(chunk) {
			return chunk.value;
		}).join(''));
		if (!parsed || !Array.isArray(parsed.months) || !Array.isArray(parsed.table)) {
			return null;
		}
		if (!parsed.generatedAt && generatedAt) {
			parsed.generatedAt = generatedAt;
		}
		return parsed;
	} catch (error) {
		return null;
	}
}

function isVklIndexCacheHeaderCompatible_(headerRow) {
	if (!Array.isArray(headerRow) || headerRow.length < VKL_INDEX_CACHE_HEADERS.length) {
		return false;
	}

	return VKL_INDEX_CACHE_HEADERS.every(function(expectedHeader, index) {
		return String(headerRow[index] || '').trim() === expectedHeader;
	});
}

function buildVklIndexCacheRowsForScope_(vklName, scope, content) {
	const chunks = splitTextIntoChunks_(JSON.stringify(content), VKL_INDEX_CACHE_CHUNK_SIZE);
	return chunks.map(function(chunk, index) {
		return [
			content.generatedAt,
			String(vklName || '').trim(),
			scope.id,
			scope.type,
			scope.label,
			Number(scope.storeIds.length || 0),
			index,
			chunks.length,
			chunk,
		];
	});
}

function splitTextIntoChunks_(text, chunkSize) {
	const value = String(text || '');
	const size = Math.max(1000, Number(chunkSize || VKL_INDEX_CACHE_CHUNK_SIZE));
	const chunks = [];

	if (!value) {
		return [''];
	}

	for (let index = 0; index < value.length; index += size) {
		chunks.push(value.slice(index, index + size));
	}

	return chunks;
}

function getVklIndexCacheJobState_() {
	const rawValue = PropertiesService.getScriptProperties().getProperty(VKL_INDEX_CACHE_JOB_PROPERTY);
	if (!rawValue) {
		return null;
	}

	try {
		const parsed = JSON.parse(rawValue);
		return parsed && typeof parsed === 'object' ? parsed : null;
	} catch (error) {
		return null;
	}
}

function setVklIndexCacheJobState_(state) {
	PropertiesService.getScriptProperties().setProperty(VKL_INDEX_CACHE_JOB_PROPERTY, JSON.stringify(state || {}));
}

function clearVklIndexCacheJobState_() {
	PropertiesService.getScriptProperties().deleteProperty(VKL_INDEX_CACHE_JOB_PROPERTY);
}

function getVklIndexCacheSourceSheets_() {
	const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
	return {
		plan: spreadsheet.getSheetByName(SHEET_NAMES.PLAN) ? SHEET_NAMES.PLAN : '',
		real: spreadsheet.getSheetByName(SHEET_NAMES.REAL)
			? SHEET_NAMES.REAL
			: (spreadsheet.getSheetByName(LEGACY_REAL_SOURCE_SHEET_NAME) ? LEGACY_REAL_SOURCE_SHEET_NAME : ''),
		vod: spreadsheet.getSheetByName(SHEET_NAMES.VOD)
			? SHEET_NAMES.VOD
			: (spreadsheet.getSheetByName(LEGACY_VOD_SOURCE_SHEET_NAME) ? LEGACY_VOD_SOURCE_SHEET_NAME : ''),
	};
}

function notifyVklIndexCacheProgress_(message) {
	const text = String(message || '').trim();
	if (!text) {
		return;
	}

	Logger.log(text);
	const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
	if (spreadsheet && spreadsheet.toast) {
		spreadsheet.toast(text, 'VKL cache', 8);
	}
}

function resetVklIndexCacheSheet_() {
	writeSummarySheet_(SHEET_NAMES.VKL_INDEX_CACHE, VKL_INDEX_CACHE_HEADERS, []);
}

function appendRowsToSheet_(sheetName, headers, rows) {
	if (!rows || !rows.length) {
		return;
	}

	const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
	const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
	const needsHeader = sheet.getLastRow() === 0 || !headers.every(function(expectedHeader, index) {
		return String(sheet.getRange(1, index + 1).getValue() || '').trim() === String(expectedHeader || '').trim();
	});

	if (needsHeader) {
		sheet.clearContents();
		sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
		sheet.setFrozenRows(1);
		sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#d71920').setFontColor('#ffffff');
		sheet.autoResizeColumns(1, headers.length);
	}

	const startRow = sheet.getLastRow() + 1;
	sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
}

function withVklIndexCacheJobLock_(callback) {
	const lock = LockService.getScriptLock();
	let hasLock = false;
	try {
		lock.waitLock(30000);
		hasLock = true;
	} catch (error) {
		throw new Error('VKL index cache job je uz spusteny. Pockaj chvilu a skus to znovu.');
	}

	try {
		return callback();
	} finally {
		if (hasLock) {
			lock.releaseLock();
		}
	}
}

function clearVklIndexCacheContinuationTriggers_() {
	ScriptApp.getProjectTriggers().forEach(function(trigger) {
		if (trigger.getHandlerFunction && trigger.getHandlerFunction() === VKL_INDEX_CACHE_CONTINUATION_HANDLER) {
			ScriptApp.deleteTrigger(trigger);
		}
	});
}

function scheduleVklIndexCacheContinuation_() {
	clearVklIndexCacheContinuationTriggers_();
	ScriptApp.newTrigger(VKL_INDEX_CACHE_CONTINUATION_HANDLER)
		.timeBased()
		.after(VKL_INDEX_CACHE_CONTINUATION_DELAY_MS)
		.create();
}

function parseSummaryCacheChildIds_(value) {
	const text = String(value || '').trim();
	if (!text) {
		return [];
	}

	try {
		const parsed = JSON.parse(text);
		return Array.isArray(parsed) ? parsed.map(function(item) {
			return String(item || '').trim();
		}).filter(Boolean) : [];
	} catch (error) {
		return text.split('||').map(function(item) {
			return String(item || '').trim();
		}).filter(Boolean);
	}
}

function buildSummaryChartsFromMetricSections_(metricSections) {
	const turnoverMetric = metricSections.find(function(section) {
		return canonicalizeMetric_(section.metric) === canonicalizeMetric_(OBRAT_METRIC);
	}) || { rows: [] };
	const hoursMetric = metricSections.find(function(section) {
		return canonicalizeMetric_(section.metric) === canonicalizeMetric_(NET_HOURS_METRIC);
	}) || { rows: [] };
	const performanceMetric = metricSections.find(function(section) {
		return canonicalizeMetric_(section.metric) === canonicalizeMetric_(CLEAN_PERFORMANCE_METRIC);
	}) || { rows: [] };

	return {
		turnover: buildSummaryChartSeriesFromMetric_(turnoverMetric, 'currency'),
		hours: buildSummaryChartSeriesFromMetric_(hoursMetric, 'hours'),
		performance: buildSummaryChartSeriesFromMetric_(performanceMetric, 'number'),
	};
}

function isSummaryCacheCompatible_(summaryData, structure) {
	if (!summaryData || !summaryData.hierarchy || !summaryData.hierarchy.nodes) {
		return false;
	}

	const nodes = summaryData.hierarchy.nodes;
	const storeIds = Object.keys((structure && structure.storeToHierarchy) || {});
	const expectedNodeCount = 1 + structure.gfs.length + structure.vkls.length + storeIds.length;
	const rootNode = nodes[summaryData.hierarchy.rootId];

	if (!rootNode || !Array.isArray(summaryData.months) || !summaryData.months.length) {
		return false;
	}

	if (Object.keys(nodes).length !== expectedNodeCount) {
		return false;
	}

	if (Number(rootNode.storeCount || 0) !== storeIds.length) {
		return false;
	}

	return SUMMARY_METRICS.every(function(metric) {
		const section = getSummaryMetricSection_(rootNode, metric);
		if (!section) {
			return false;
		}
		const realRow = getSummaryMetricRow_(section, 'real');
		return Array.isArray(realRow.values) && realRow.values.length === summaryData.months.length;
	});
}

function writeSummaryCache_(hierarchy, months, generatedAt) {
	const rows = buildSummaryCacheRows_(hierarchy, months, generatedAt);
	writeSummarySheet_(SHEET_NAMES.SUMMARY_CACHE, SUMMARY_CACHE_HEADERS.concat(months), rows);
	return {
		rows: rows.length,
		nodeCount: Object.keys((hierarchy && hierarchy.nodes) || {}).length,
		generatedAt: generatedAt,
	};
}

function buildSummaryCacheRows_(hierarchy, months, generatedAt) {
	return getSummaryHierarchyNodeOrder_(hierarchy).reduce(function(rows, nodeId) {
		const node = hierarchy.nodes[nodeId];
		if (!node) {
			return rows;
		}

		(node.metrics || []).forEach(function(metricSection) {
			(metricSection.rows || []).forEach(function(row) {
				rows.push([
					generatedAt,
					node.id,
					node.type,
					node.label,
					node.parentId || '',
					JSON.stringify(node.childIds || []),
					Number(node.storeCount || 0),
					metricSection.metric,
					metricSection.format || getMetricFormat_(metricSection.metric),
					row.type,
					row.label,
					Number(row.total || 0),
					Number(row.actualTotal || 0),
					JSON.stringify(Array.isArray(row.actualValues) ? row.actualValues : []),
					JSON.stringify(Array.isArray(row.hasRealFlags) ? row.hasRealFlags : [])
				].concat(months.map(function(month, monthIndex) {
					return Number((row.values && row.values[monthIndex]) || 0);
				})));
			});
		});

		return rows;
	}, []);
}

function getSummaryHierarchyNodeOrder_(hierarchy) {
	const orderedIds = [];
	const visited = {};

	function visitNode(nodeId) {
		if (!nodeId || visited[nodeId] || !hierarchy.nodes[nodeId]) {
			return;
		}

		visited[nodeId] = true;
		orderedIds.push(nodeId);
		(hierarchy.nodes[nodeId].childIds || []).forEach(visitNode);
	}

	if (hierarchy && hierarchy.rootId && hierarchy.nodes) {
		visitNode(hierarchy.rootId);
		Object.keys(hierarchy.nodes).forEach(visitNode);
	}

	return orderedIds;
}

function buildAggregatedSummaryNode_(scope, childNodes, months) {
	const turnoverMetric = aggregateSummaryMetricSection_(childNodes, OBRAT_METRIC, months);
	const hoursMetric = aggregateSummaryMetricSection_(childNodes, NET_HOURS_METRIC, months);
	const structureMetric = aggregateSummaryMetricSection_(childNodes, STRUCTURE_HOURS_METRIC, months);
	const performanceMetric = buildAggregatedPerformanceSummaryMetric_(turnoverMetric, hoursMetric, months);
	const metrics = [turnoverMetric, hoursMetric, structureMetric, performanceMetric];

	return {
		id: scope.id,
		type: scope.type,
		label: scope.label,
		storeCount: scope.storeIds.length,
		metrics: metrics,
		charts: {
			turnover: buildSummaryChartSeriesFromMetric_(turnoverMetric, 'currency'),
			hours: buildSummaryChartSeriesFromMetric_(hoursMetric, 'hours'),
			performance: buildSummaryChartSeriesFromMetric_(performanceMetric, 'number'),
		},
	};
}

function aggregateSummaryMetricSection_(childNodes, metric, months) {
	const childSections = (childNodes || []).map(function(node) {
		return getSummaryMetricSection_(node, metric);
	}).filter(function(section) {
		return Boolean(section);
	});
	const rowTypes = [];

	childSections.forEach(function(section) {
		(section.rows || []).forEach(function(row) {
			if (rowTypes.indexOf(row.type) === -1) {
				rowTypes.push(row.type);
			}
		});
	});

	const rows = rowTypes.map(function(rowType) {
		const values = months.map(function(month, monthIndex) {
			return childSections.reduce(function(sum, section) {
				const row = getSummaryMetricRow_(section, rowType);
				return sum + Number((row.values && row.values[monthIndex]) || 0);
			}, 0);
		});
		const aggregatedRow = {
			type: rowType,
			label: getSummaryMetricRowLabel_(childSections, rowType),
			values: values,
			total: summarizeSummaryMetricTotal_(metric, values),
		};

		if (rowType === 'real') {
			aggregatedRow.actualValues = months.map(function(month, monthIndex) {
				return childSections.reduce(function(sum, section) {
					const row = getSummaryMetricRow_(section, rowType);
					return sum + Number((row.actualValues && row.actualValues[monthIndex]) || 0);
				}, 0);
			});
			aggregatedRow.hasRealFlags = months.map(function(month, monthIndex) {
				return childSections.some(function(section) {
					const row = getSummaryMetricRow_(section, rowType);
					return Boolean(row.hasRealFlags && row.hasRealFlags[monthIndex]);
				});
			});
			aggregatedRow.actualTotal = summarizeSummaryMetricTotal_(metric, aggregatedRow.actualValues);
		}

		return aggregatedRow;
	});

	return {
		metric: metric,
		format: getMetricFormat_(metric),
		rows: rows,
	};
}

function buildAggregatedPerformanceSummaryMetric_(turnoverMetric, hoursMetric, months) {
	const planTurnover = getSummaryMetricRow_(turnoverMetric, 'plan');
	const realTurnover = getSummaryMetricRow_(turnoverMetric, 'real');
	const forecastTurnover = getSummaryMetricRow_(turnoverMetric, 'forecast');
	const planHours = getSummaryMetricRow_(hoursMetric, 'plan');
	const realHours = getSummaryMetricRow_(hoursMetric, 'real');
	const forecastHours = getSummaryMetricRow_(hoursMetric, 'forecast');
	const turnoverActualValues = Array.isArray(realTurnover.actualValues) ? realTurnover.actualValues : (realTurnover.values || []);
	const hoursActualValues = Array.isArray(realHours.actualValues) ? realHours.actualValues : (realHours.values || []);
	const turnoverHasRealFlags = Array.isArray(realTurnover.hasRealFlags)
		? realTurnover.hasRealFlags
		: months.map(function(month, index) {
			return Math.abs(Number((realTurnover.values && realTurnover.values[index]) || 0)) > 0.0001;
		});
	const hoursHasRealFlags = Array.isArray(realHours.hasRealFlags)
		? realHours.hasRealFlags
		: months.map(function(month, index) {
			return Math.abs(Number((realHours.values && realHours.values[index]) || 0)) > 0.0001;
		});

	const planValues = divideSummarySeries_(planTurnover.values, planHours.values);
	const realValues = divideSummarySeries_(realTurnover.values, realHours.values);
	const hasRealFlags = months.map(function(month, index) {
		return Boolean(turnoverHasRealFlags[index]) && Boolean(hoursHasRealFlags[index]);
	});
	const actualValues = months.map(function(month, index) {
		if (!hasRealFlags[index]) {
			return 0;
		}
		const actualHours = Number(hoursActualValues[index] || 0);
		return actualHours ? Number(turnoverActualValues[index] || 0) / actualHours : 0;
	});
	const forecastValues = months.map(function(month, index) {
		if (hasRealFlags[index]) {
			return Number(actualValues[index] || 0);
		}
		const forecastHoursValue = Number((forecastHours.values && forecastHours.values[index]) || 0);
		return forecastHoursValue ? Number((forecastTurnover.values && forecastTurnover.values[index]) || 0) / forecastHoursValue : 0;
	});
	const adjustmentValues = months.map(function() {
		return 0;
	});
	const deltaValues = months.map(function(month, index) {
		return getMetricDeltaValue_(CLEAN_PERFORMANCE_METRIC, planValues[index], actualValues[index], hasRealFlags[index], forecastValues[index]);
	});

	return {
		metric: CLEAN_PERFORMANCE_METRIC,
		format: 'number',
		rows: [
			{ type: 'plan', label: getMetricRowDisplayLabel_('plan'), values: planValues, total: summarizeSummaryMetricTotal_(CLEAN_PERFORMANCE_METRIC, planValues) },
			{ type: 'real', label: getMetricRowDisplayLabel_('real'), values: realValues, actualValues: actualValues, hasRealFlags: hasRealFlags, total: summarizeSummaryMetricTotal_(CLEAN_PERFORMANCE_METRIC, realValues), actualTotal: summarizeSummaryMetricTotal_(CLEAN_PERFORMANCE_METRIC, actualValues) },
			{ type: 'adjustment', label: getMetricRowDisplayLabel_('adjustment'), values: adjustmentValues, total: 0 },
			{ type: 'forecast', label: getMetricRowDisplayLabel_('forecast'), values: forecastValues, total: summarizeSummaryMetricTotal_(CLEAN_PERFORMANCE_METRIC, forecastValues) },
			{ type: 'delta', label: getMetricRowDisplayLabel_('delta'), values: deltaValues, total: summarizeSummaryMetricTotal_(CLEAN_PERFORMANCE_METRIC, deltaValues) },
		],
	};
}

function buildSummaryChartSeriesFromMetric_(metricSection, format) {
	const planRow = getSummaryMetricRow_(metricSection, 'plan');
	const realRow = getSummaryMetricRow_(metricSection, 'real');
	const forecastRow = getSummaryMetricRow_(metricSection, 'forecast');
	const adjustmentRow = getSummaryMetricRow_(metricSection, 'adjustment');
	return {
		labels: [],
		plan: planRow.values || [],
		real: realRow.values || [],
		forecast: forecastRow.values || [],
		adjustment: adjustmentRow.values || [],
		format: format,
	};
}

function divideSummarySeries_(numeratorValues, denominatorValues) {
	const numerator = numeratorValues || [];
	const denominator = denominatorValues || [];
	return numerator.map(function(value, index) {
		const denominatorValue = Number(denominator[index] || 0);
		return denominatorValue ? Number(value || 0) / denominatorValue : 0;
	});
}

function summarizeSummaryMetricTotal_(metric, values) {
	if (canonicalizeMetric_(metric) === CLEAN_PERFORMANCE_METRIC) {
		return roundMetric_(metric, averageValues_(values || []));
	}
	return roundMetric_(metric, sumValues_(values || []));
}

function getSummaryMetricSection_(node, metric) {
	if (!node || !Array.isArray(node.metrics)) {
		return null;
	}
	for (let index = 0; index < node.metrics.length; index += 1) {
		if (canonicalizeMetric_(node.metrics[index].metric) === canonicalizeMetric_(metric)) {
			return node.metrics[index];
		}
	}
	return null;
}

function getSummaryMetricRow_(section, rowType) {
	if (!section || !Array.isArray(section.rows)) {
		return { values: [], total: 0, label: '' };
	}
	for (let index = 0; index < section.rows.length; index += 1) {
		if (section.rows[index].type === rowType) {
			return section.rows[index];
		}
	}
	return { values: [], total: 0, label: '' };
}

function getSummaryMetricRowLabel_(sections, rowType) {
	for (let index = 0; index < (sections || []).length; index += 1) {
		const row = getSummaryMetricRow_(sections[index], rowType);
		if (row.label) {
			return row.label;
		}
	}
	return getMetricRowDisplayLabel_(rowType);
}

function buildSummaryMetrics_(dataset, months, metrics) {
	return metrics.map(function(metric) {
		if (canonicalizeMetric_(metric) === canonicalizeMetric_(CLEAN_PERFORMANCE_METRIC)) {
			return buildSummaryPerformanceMetricFromDataset_(dataset, months);
		}

		const metricRow = getMetricRow_(dataset.rows, metric, months);
		const totals = summarizeMetric_(metric, metricRow, months);
		const adjustmentTotal = months.reduce(function(sum, month) {
			return sum + metricRow[month].adjustment;
		}, 0);
		const deltaRow = buildSmartDeltaRow_(metric, metricRow, months);
		const realValues = months.map(function(month) {
			return getDisplayedIstValue_(metric, metricRow[month]);
		});
		const realTotal = summarizeDisplayedValues_(metric, realValues);
		const rows = [
			{ type: 'plan', label: getMetricRowDisplayLabel_('plan'), values: months.map(function(month) { return metricRow[month].plan; }), total: totals.plan },
		];

		rows.push({
			type: 'real',
			label: getMetricRowDisplayLabel_('real'),
			values: realValues,
			actualValues: months.map(function(month) { return metricRow[month].real; }),
			hasRealFlags: months.map(function(month) { return Boolean(metricRow[month].hasRealData); }),
			total: realTotal,
			actualTotal: totals.real,
		});

		rows.push({
			type: 'adjustment',
			label: getMetricRowDisplayLabel_('adjustment'),
			values: months.map(function(month) { return metricRow[month].adjustment; }),
			total: roundMetric_(metric, adjustmentTotal),
		});
		rows.push({ type: 'forecast', label: getMetricRowDisplayLabel_('forecast'), values: months.map(function(month) { return metricRow[month].forecast; }), total: totals.forecast });
		rows.push(deltaRow);

		return {
			metric: metric,
			format: getMetricFormat_(metric),
			rows: rows,
		};
	});
}

function buildSummaryPerformanceMetricFromDataset_(dataset, months) {
	const turnoverRow = getMetricRow_(dataset.rows, OBRAT_METRIC, months);
	const hoursRow = getMetricRow_(dataset.rows, NET_HOURS_METRIC, months);
	const planValues = months.map(function(month) {
		const monthHours = Number(hoursRow[month].plan || 0);
		return monthHours ? Number(turnoverRow[month].plan || 0) / monthHours : 0;
	});
	const realValues = months.map(function(month) {
		const displayedHours = Number(getDisplayedIstValue_(NET_HOURS_METRIC, hoursRow[month]) || 0);
		const displayedTurnover = Number(getDisplayedIstValue_(OBRAT_METRIC, turnoverRow[month]) || 0);
		return displayedHours ? displayedTurnover / displayedHours : 0;
	});
	const hasRealFlags = months.map(function(month) {
		return Boolean(turnoverRow[month].hasRealData) && Boolean(hoursRow[month].hasRealData);
	});
	const actualValues = months.map(function(month, index) {
		if (!hasRealFlags[index]) {
			return 0;
		}
		const actualHours = Number(hoursRow[month].real || 0);
		return actualHours ? Number(turnoverRow[month].real || 0) / actualHours : 0;
	});
	const forecastValues = months.map(function(month, index) {
		if (hasRealFlags[index]) {
			return Number(actualValues[index] || 0);
		}
		const forecastHours = Number(hoursRow[month].forecast || 0);
		return forecastHours ? Number(turnoverRow[month].forecast || 0) / forecastHours : 0;
	});
	const adjustmentValues = months.map(function() {
		return 0;
	});
	const deltaValues = months.map(function(month, index) {
		return getMetricDeltaValue_(CLEAN_PERFORMANCE_METRIC, planValues[index], actualValues[index], hasRealFlags[index], forecastValues[index]);
	});

	const planTurnoverTotal = months.reduce(function(sum, month) {
		return sum + Number(turnoverRow[month].plan || 0);
	}, 0);
	const planHoursTotal = months.reduce(function(sum, month) {
		return sum + Number(hoursRow[month].plan || 0);
	}, 0);
	const displayedTurnoverTotal = months.reduce(function(sum, month) {
		return sum + Number(getDisplayedIstValue_(OBRAT_METRIC, turnoverRow[month]) || 0);
	}, 0);
	const displayedHoursTotal = months.reduce(function(sum, month) {
		return sum + Number(getDisplayedIstValue_(NET_HOURS_METRIC, hoursRow[month]) || 0);
	}, 0);
	const forecastTurnoverTotal = months.reduce(function(sum, month) {
		return sum + Number(turnoverRow[month].forecast || 0);
	}, 0);
	const forecastHoursTotal = months.reduce(function(sum, month) {
		return sum + Number(hoursRow[month].forecast || 0);
	}, 0);
	const planTotal = planHoursTotal ? planTurnoverTotal / planHoursTotal : 0;
	const realTotal = displayedHoursTotal ? displayedTurnoverTotal / displayedHoursTotal : 0;
	const forecastTotal = forecastHoursTotal ? forecastTurnoverTotal / forecastHoursTotal : 0;

	return {
		metric: CLEAN_PERFORMANCE_METRIC,
		format: 'number',
		rows: [
			{ type: 'plan', label: getMetricRowDisplayLabel_('plan'), values: planValues, total: roundMetric_(CLEAN_PERFORMANCE_METRIC, planTotal) },
			{ type: 'real', label: getMetricRowDisplayLabel_('real'), values: realValues, actualValues: actualValues, hasRealFlags: hasRealFlags, total: roundMetric_(CLEAN_PERFORMANCE_METRIC, realTotal), actualTotal: summarizeSummaryMetricTotal_(CLEAN_PERFORMANCE_METRIC, actualValues) },
			{ type: 'adjustment', label: getMetricRowDisplayLabel_('adjustment'), values: adjustmentValues, total: 0 },
			{ type: 'forecast', label: getMetricRowDisplayLabel_('forecast'), values: forecastValues, total: roundMetric_(CLEAN_PERFORMANCE_METRIC, forecastTotal) },
			{ type: 'delta', label: getMetricRowDisplayLabel_('delta'), values: deltaValues, total: roundMetric_(CLEAN_PERFORMANCE_METRIC, forecastTotal - realTotal) },
		],
	};
}

function getSuggestedSummaryMonth_(months) {
	const currentMonthLabel = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM yyyy');
	const normalizedCurrent = normalizeText_(currentMonthLabel);
	const match = months.find(function(month) {
		return normalizeText_(month) === normalizedCurrent;
	});
	return match || '__YEAR__';
}

function saveVodAdjustments(loginValue, storeId, updates) {
	const user = authenticateUser(loginValue, { context: 'dashboard' });
	const planData = getMetricSheetData(SHEET_NAMES.PLAN);
	return saveVodAdjustments_(user, storeId, updates, planData);
}

function saveVodAdjustments_(user, storeId, updates, planData) {
	const normalizedStoreId = String(storeId || '').trim();

	if (user.role !== 'VOD') {
		throw new Error('Upravy VOD moze zapisovat iba VOD pouzivatel.');
	}

	if (normalizedStoreId !== user.primaryStoreId) {
		throw new Error('VOD moze upravovat iba svoju filialku.');
	}

	if (!updates || !updates.length) {
		return { saved: 0 };
	}

	const sheet = getSheetWithLegacyFallback_(SHEET_NAMES.VOD, LEGACY_VOD_SOURCE_SHEET_NAME);
	const values = sheet.getDataRange().getValues();
	const headerMonths = values[0].slice(3);
	const monthToColumn = {};
	headerMonths.forEach(function(month, index) {
		monthToColumn[normalizeSheetMonthLabel_(month)] = index + 4;
	});

	const rowIndex = {};
	let currentStoreId = '';
	for (let row = 1; row < values.length; row += 1) {
		if (values[row][0]) {
			currentStoreId = String(values[row][0]).trim();
		}
		const metric = String(values[row][2] || '').trim();
		if (!currentStoreId || !metric) {
			continue;
		}
		rowIndex[currentStoreId + '|' + metric] = row + 1;
	}

	const storeName = planData.storeNames[normalizedStoreId] || '';
	const writes = [];

	updates.forEach(function(update) {
		const metric = String(update.metric || '').trim();
		const month = normalizeSheetMonthLabel_(update.month);
		const value = Number(update.value || 0);

		if (!metric || !monthToColumn[month]) {
			return;
		}

		let targetRow = rowIndex[normalizedStoreId + '|' + metric];
		if (!targetRow) {
			targetRow = Math.max(sheet.getLastRow() + 1, 2);
			sheet.getRange(targetRow, 1, 1, 3).setValues([[normalizedStoreId, storeName, metric]]);
			rowIndex[normalizedStoreId + '|' + metric] = targetRow;
		}

		writes.push({
			row: targetRow,
			column: monthToColumn[month],
			value: value,
		});
	});

	writes.forEach(function(write) {
		sheet.getRange(write.row, write.column).setValue(write.value);
	});

	return {
		saved: writes.length,
		updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss'),
	};
}

function saveWeeklyVodOverrides_(user, storeId, adjustmentUpdates, weeklyUpdates) {
	const normalizedStoreId = String(storeId || '').trim();

	if (user.role !== 'VOD') {
		throw new Error('Tyzdenne upravy moze zapisovat iba VOD pouzivatel.');
	}

	if (normalizedStoreId !== user.primaryStoreId) {
		throw new Error('VOD moze upravovat tyzdenne hodnoty iba pre svoju filialku.');
	}

	const touchedKeys = {};
	(adjustmentUpdates || []).forEach(function(update) {
		const metric = canonicalizeMetric_(update.metric);
		const month = normalizeSheetMonthLabel_(update.month);
		if (!metric || !month) {
			return;
		}
		touchedKeys[[metric, month].join('|')] = true;
	});

	const groupedRows = {};
	(weeklyUpdates || []).forEach(function(update) {
		const metric = canonicalizeMetric_(update.metric);
		const month = normalizeSheetMonthLabel_(update.month);
		const weekIndex = Math.max(0, Number(update.weekIndex || 0));
		if (!metric || !month) {
			return;
		}

		const key = [metric, month].join('|');
		touchedKeys[key] = true;
		if (!groupedRows[key]) {
			groupedRows[key] = [];
		}

		groupedRows[key].push({
			metric: metric,
			month: month,
			weekIndex: weekIndex,
			weekLabel: String(update.weekLabel || '').trim(),
			rangeLabel: String(update.rangeLabel || '').trim(),
			value: Number(update.value || 0),
			distributionMode: String(update.distributionMode || '').trim(),
		});
	});

	const touchedKeyList = Object.keys(touchedKeys);
	if (!touchedKeyList.length) {
		return { saved: 0, updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss') };
	}

	const sheet = ensureWeeklyVodOverridesSheet_();
	const values = sheet.getDataRange().getValues();
	const retainedRows = [];

	for (let row = 1; row < values.length; row += 1) {
		const rowStoreId = String(values[row][0] || '').trim();
		const rowMetric = canonicalizeMetric_(values[row][1]);
		const rowMonth = normalizeSheetMonthLabel_(values[row][2]);
		const rowKey = [rowMetric, rowMonth].join('|');
		if (rowStoreId === normalizedStoreId && touchedKeys[rowKey]) {
			continue;
		}
		retainedRows.push(values[row].slice(0, WEEKLY_VOD_OVERRIDE_HEADERS.length));
	}

	const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss');
	const newRows = [];
	Object.keys(groupedRows).sort().forEach(function(key) {
		groupedRows[key].sort(function(left, right) {
			return left.weekIndex - right.weekIndex;
		}).forEach(function(row) {
			newRows.push([
				normalizedStoreId,
				row.metric,
				row.month,
				row.weekIndex,
				row.weekLabel,
				row.rangeLabel,
				row.value,
				row.distributionMode,
				timestamp,
				user.displayName,
			]);
		});
	});

	const allRows = retainedRows.concat(newRows);
	sheet.clearContents();
	sheet.getRange(1, 1, 1, WEEKLY_VOD_OVERRIDE_HEADERS.length).setValues([WEEKLY_VOD_OVERRIDE_HEADERS]);
	if (allRows.length) {
		sheet.getRange(2, 1, allRows.length, WEEKLY_VOD_OVERRIDE_HEADERS.length).setValues(allRows);
	}
	sheet.setFrozenRows(1);
	sheet.getRange(1, 1, 1, WEEKLY_VOD_OVERRIDE_HEADERS.length).setFontWeight('bold').setBackground('#d71920').setFontColor('#ffffff');
	sheet.autoResizeColumns(1, WEEKLY_VOD_OVERRIDE_HEADERS.length);

	return {
		saved: newRows.length,
		updatedAt: timestamp,
	};
}

function readWeeklyVodOverridesForStores_(storeIds, monthLabel) {
	return readWeeklyVodOverridePayloadForStores_(storeIds, monthLabel).overrides;
}

function readWeeklyVodOverridePayloadForStores_(storeIds, monthLabel) {
	const normalizedMonth = normalizeSheetMonthLabel_(monthLabel);
	if (!normalizedMonth) {
		return {
			overrides: {},
			storeOverrides: {},
		};
	}

	const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
	const sheet = spreadsheet.getSheetByName(SHEET_NAMES.WEEKLY_VOD_OVERRIDES);
	if (!sheet || sheet.getLastRow() < 2) {
		return {
			overrides: {},
			storeOverrides: {},
		};
	}

	const allowedStores = {};
	(storeIds || []).forEach(function(storeId) {
		allowedStores[String(storeId || '').trim()] = true;
	});

	const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, WEEKLY_VOD_OVERRIDE_HEADERS.length).getValues();
	const overrides = {};
	const storeOverrides = {};
	for (let row = 0; row < values.length; row += 1) {
		const rowStoreId = String(values[row][0] || '').trim();
		const metric = canonicalizeMetric_(values[row][1]);
		const rowMonth = normalizeSheetMonthLabel_(values[row][2]);
		const weekIndex = Math.max(0, Number(values[row][3] || 0));
		const value = Number(values[row][6] || 0);
		const distributionMode = String(values[row][7] || '').trim();

		if (!allowedStores[rowStoreId] || rowMonth !== normalizedMonth || !metric) {
			continue;
		}

		if (!overrides[metric]) {
			overrides[metric] = {
				values: [],
				distributionMode: distributionMode,
			};
		}

		overrides[metric].values[weekIndex] = Number(overrides[metric].values[weekIndex] || 0) + value;
		if (distributionMode) {
			overrides[metric].distributionMode = distributionMode;
		}

		if (!storeOverrides[rowStoreId]) {
			storeOverrides[rowStoreId] = {};
		}
		if (!storeOverrides[rowStoreId][metric]) {
			storeOverrides[rowStoreId][metric] = {
				values: [],
				distributionMode: distributionMode,
			};
		}

		storeOverrides[rowStoreId][metric].values[weekIndex] = Number(storeOverrides[rowStoreId][metric].values[weekIndex] || 0) + value;
		if (distributionMode) {
			storeOverrides[rowStoreId][metric].distributionMode = distributionMode;
		}
	}

	return {
		overrides: overrides,
		storeOverrides: storeOverrides,
	};
}

function saveMetricNotes(loginValue, selectedScope, noteUpdates) {
	const user = authenticateUser(loginValue, { context: 'dashboard' });
	const structure = getStructureData();
	const planData = getMetricSheetData(SHEET_NAMES.PLAN);
	const scope = resolveScope(user, selectedScope, structure, planData.storeNames);
	return saveMetricNotes_(user, scope, noteUpdates);
}

function getScopeNotes(loginValue, selectedScope) {
	const user = authenticateUser(loginValue, { context: 'dashboard' });
	const structure = getStructureData();
	const planData = getMetricSheetData(SHEET_NAMES.PLAN);
	const scope = resolveScope(user, selectedScope, structure, planData.storeNames);
	return getMetricNotesForScopeMetric_(buildNoteScope_(user, scope), GLOBAL_SCOPE_NOTE_METRIC);
}

function saveMetricNotes_(user, scope, noteUpdates) {
	if (['VOD', 'VKL'].indexOf(user.role) === -1) {
		throw new Error('Poznamky moze zapisovat iba VOD alebo VKL.');
	}

	if (user.role === 'VOD' && (scope.type !== 'STORE' || scope.storeIds[0] !== user.primaryStoreId)) {
		throw new Error('VOD moze zapisovat poznamku iba pre svoju filialku.');
	}

	if (!noteUpdates || !noteUpdates.length) {
		return { saved: 0 };
	}

	const noteScope = buildNoteScope_(user, scope);
	const sheet = ensureNotesSheet_();
	const values = sheet.getDataRange().getValues();
	const rowIndex = {};

	for (let row = 1; row < values.length; row += 1) {
		const scopeKey = String(values[row][0] || '').trim();
		const metric = normalizeNoteMetricKey_(values[row][4]);
		const role = String(values[row][5] || '').trim().toUpperCase();
		if (!scopeKey || !metric || !role) {
			continue;
		}
		rowIndex[[scopeKey, role, metric].join('|')] = row + 1;
	}

	const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss');
	let saved = 0;

	noteUpdates.forEach(function(update) {
		const metric = normalizeNoteMetricKey_(update.metric);
		const noteText = String(update.text == null ? '' : update.text).trim();
		if (!metric) {
			return;
		}

		const key = [noteScope.key, user.role, metric].join('|');
		let targetRow = rowIndex[key];

		if (!targetRow && !noteText) {
			return;
		}

		if (!targetRow) {
			targetRow = Math.max(sheet.getLastRow() + 1, 2);
			rowIndex[key] = targetRow;
		}

		sheet.getRange(targetRow, 1, 1, 9).setValues([[ 
			noteScope.key,
			noteScope.type,
			noteScope.scopeId,
			noteScope.label,
			metric === GLOBAL_SCOPE_NOTE_METRIC ? GLOBAL_SCOPE_NOTE_METRIC : metric,
			user.role,
			user.displayName,
			noteText,
			timestamp,
		]]);
		saved += 1;
	});

	return {
		saved: saved,
		updatedAt: timestamp,
	};
}

function createSummarySheets() {
	return createSummaryCache();
}

function authenticateUser(loginValue, options) {
	const lookup = String(loginValue || '').trim().toLowerCase();
	const context = options && options.context ? String(options.context).trim().toLowerCase() : 'dashboard';
	if (!lookup) {
		throw new Error('Zadaj email alebo test identifikator.');
	}

	const loginSheet = getRequiredSheet_(SHEET_NAMES.LOGIN);
	const values = loginSheet.getDataRange().getValues();
	const loginColumns = getLoginSheetColumnIndexes_(values[0] || []);
	const structure = options && options.structure ? options.structure : getStructureData();
	let gfName = '';
	let gfEmail = '';
	let currentVklName = '';
	let currentVklEmail = '';
	let currentAdminName = '';
	let currentAdminEmail = '';

	for (let row = 1; row < values.length; row += 1) {
		if (values[row][loginColumns.GF_NAME]) {
			gfName = String(values[row][loginColumns.GF_NAME]).trim();
		}
		if (values[row][loginColumns.GF_EMAIL]) {
			gfEmail = String(values[row][loginColumns.GF_EMAIL]).trim();
		}
		if (values[row][loginColumns.VKL_NAME]) {
			currentVklName = String(values[row][loginColumns.VKL_NAME]).trim();
		}
		if (values[row][loginColumns.VKL_EMAIL]) {
			currentVklEmail = String(values[row][loginColumns.VKL_EMAIL]).trim();
		}
		if (values[row][loginColumns.ADMIN_NAME]) {
			currentAdminName = String(values[row][loginColumns.ADMIN_NAME]).trim();
		}
		if (values[row][loginColumns.ADMIN_EMAIL]) {
			currentAdminEmail = String(values[row][loginColumns.ADMIN_EMAIL]).trim();
		}

		const vodIdentifier = String(values[row][loginColumns.VOD_IDENTIFIER] || values[row][loginColumns.STORE_ID] || '').trim();

		if (currentAdminEmail && currentAdminEmail.toLowerCase() === lookup) {
			if (context === 'dashboard') {
				throw new Error('Admin účet má prístup iba do sumáru, nie do filiálkového dashboardu.');
			}

			return {
				role: 'ADMIN',
				displayName: currentAdminName || 'Admin',
				email: currentAdminEmail,
				primaryStoreId: '',
				gfName: '',
				vklName: '',
				accessibleStoreIds: Object.keys(structure.storeToHierarchy).sort(),
			};
		}

		if (gfEmail && gfEmail.toLowerCase() === lookup) {
			return {
				role: 'GF',
				displayName: gfName,
				email: gfEmail,
				primaryStoreId: '',
				gfName: gfName,
				vklName: '',
				accessibleStoreIds: structure.gfToStores[gfName] || [],
			};
		}

		if (currentVklEmail && currentVklEmail.toLowerCase() === lookup) {
			return {
				role: 'VKL',
				displayName: currentVklName,
				email: currentVklEmail,
				primaryStoreId: '',
				gfName: structure.vklToGf[currentVklName] || gfName,
				vklName: currentVklName,
				accessibleStoreIds: structure.vklToStores[currentVklName] || [],
			};
		}

		if (vodIdentifier && vodIdentifier.toLowerCase() === lookup) {
			const storeId = String(values[row][loginColumns.STORE_ID] || values[row][loginColumns.VOD_IDENTIFIER]).trim();
			return {
				role: 'VOD',
				displayName: 'VOD ' + storeId,
				email: vodIdentifier,
				primaryStoreId: storeId,
				gfName: structure.storeToHierarchy[storeId] ? structure.storeToHierarchy[storeId].gf : gfName,
				vklName: structure.storeToHierarchy[storeId] ? structure.storeToHierarchy[storeId].vkl : currentVklName,
				accessibleStoreIds: [storeId],
			};
		}
	}

	throw new Error('Pouzivatel nebol najdeny v Login sheete.');
}

function getLoginSheetColumnIndexes_(headerRow) {
	const normalizedHeaders = (headerRow || []).map(function(cell) {
		return normalizeText_(cell).replace(/\s+/g, ' ');
	});
	const result = {};

	Object.keys(LOGIN_SHEET_COLUMN_ALIASES).forEach(function(key) {
		const aliases = LOGIN_SHEET_COLUMN_ALIASES[key].map(function(alias) {
			return normalizeText_(alias).replace(/\s+/g, ' ');
		});
		let matchedIndex = -1;
		for (let index = 0; index < normalizedHeaders.length; index += 1) {
			if (aliases.indexOf(normalizedHeaders[index]) > -1) {
				matchedIndex = index;
				break;
			}
		}
		result[key] = matchedIndex > -1 ? matchedIndex : LOGIN_SHEET_COLUMN_FALLBACKS[key];
	});

	return result;
}

function getStructureData() {
	const sheet = getRequiredSheet_(SHEET_NAMES.STRUCTURE);
	const values = sheet.getDataRange().getValues();
	const storeToHierarchy = {};
	const vklToStores = {};
	const gfToStores = {};
	const vklToGf = {};
	const gfs = [];
	const vkls = [];

	for (let row = 1; row < values.length; row += 1) {
		const gf = String(values[row][0] || '').trim();
		const vkl = String(values[row][1] || '').trim();
		const storeId = String(values[row][2] || '').trim();

		if (!gf || !vkl || !storeId) {
			continue;
		}

		if (gfs.indexOf(gf) === -1) {
			gfs.push(gf);
		}
		if (vkls.indexOf(vkl) === -1) {
			vkls.push(vkl);
		}

		if (!vklToStores[vkl]) {
			vklToStores[vkl] = [];
		}
		if (!gfToStores[gf]) {
			gfToStores[gf] = [];
		}

		if (vklToStores[vkl].indexOf(storeId) === -1) {
			vklToStores[vkl].push(storeId);
		}
		if (gfToStores[gf].indexOf(storeId) === -1) {
			gfToStores[gf].push(storeId);
		}

		vklToGf[vkl] = gf;
		storeToHierarchy[storeId] = { gf: gf, vkl: vkl };
	}

	return {
		gfs: gfs,
		vkls: vkls,
		storeToHierarchy: storeToHierarchy,
		vklToStores: vklToStores,
		gfToStores: gfToStores,
		vklToGf: vklToGf,
	};
}

function getMetricSheetData(sheetName, options) {
	const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
	if (sheetName === SHEET_NAMES.PLAN && !spreadsheet.getSheetByName(sheetName)) {
		throw new Error('Sheet ' + sheetName + ' neexistuje. Spusti createPlanGj2026SheetFromCsv().');
	}

	if (sheetName === SHEET_NAMES.VOD && !spreadsheet.getSheetByName(sheetName)) {
		if (spreadsheet.getSheetByName(LEGACY_VOD_SOURCE_SHEET_NAME)) {
			return getMetricSheetDataFromSheet_(LEGACY_VOD_SOURCE_SHEET_NAME, options);
		}
		throw new Error('Sheet ' + sheetName + ' neexistuje. Vytvor alebo premenuj VOD sheet.');
	}

	if (sheetName === SHEET_NAMES.REAL && !spreadsheet.getSheetByName(sheetName)) {
		if (spreadsheet.getSheetByName(LEGACY_REAL_SOURCE_SHEET_NAME)) {
			return getMetricSheetDataFromSheet_(LEGACY_REAL_SOURCE_SHEET_NAME, options);
		}
		throw new Error('Sheet ' + sheetName + ' neexistuje. Spusti createIstGj2026SheetFromPlan().');
	}

	return getMetricSheetDataFromSheet_(sheetName, options);
}

function getMetricSheetDataFromSheet_(sheetName, options) {
	const sheet = getRequiredSheet_(sheetName);
	const requestedStoreIds = normalizeMetricSheetRequestedStoreIds_(options && options.storeIds);
	const values = requestedStoreIds.length
		? getMetricSheetValuesForStoreIds_(sheet, requestedStoreIds)
		: sheet.getDataRange().getValues();
	if (values.length < 2) {
		if (requestedStoreIds.length && values.length === 1) {
			const sourceMonths = values[0].slice(3).filter(function(month) {
				return normalizeSheetMonthLabel_(month) !== '';
			}).map(function(month) {
				return normalizeSheetMonthLabel_(month);
			});
			return {
				months: sortMonthsForBusinessYear_(sourceMonths),
				metricOrder: [],
				storeNames: {},
				records: {},
				presence: {},
			};
		}
		throw new Error('Sheet ' + sheetName + ' nema data.');
	}

	const sourceMonths = values[0].slice(3).filter(function(month) {
		return normalizeSheetMonthLabel_(month) !== '';
	}).map(function(month) {
		return normalizeSheetMonthLabel_(month);
	});
	const months = sortMonthsForBusinessYear_(sourceMonths);
	const metricOrder = [];
	const storeNames = {};
	const records = {};
	const presence = {};
	let currentStoreId = '';
	let currentStoreName = '';

	for (let row = 1; row < values.length; row += 1) {
		if (values[row][0]) {
			currentStoreId = String(values[row][0]).trim();
		}
		if (values[row][1]) {
			currentStoreName = String(values[row][1]).trim();
		}
		const metric = String(values[row][2] || '').trim();
		if (!currentStoreId || !metric) {
			continue;
		}

		if (!storeNames[currentStoreId]) {
			storeNames[currentStoreId] = sanitizeStoreName_(currentStoreId, currentStoreName);
		}
		if (metricOrder.indexOf(metric) === -1) {
			metricOrder.push(metric);
		}

		sourceMonths.forEach(function(month, monthIndex) {
			const key = buildKey_(currentStoreId, metric, month);
			const rawValue = values[row][monthIndex + 3];
			const numericCell = parsePlanCsvNumber_(rawValue);
			records[key] = numericCell.value;
			presence[key] = numericCell.present;
		});
	}

	return {
		months: months,
		metricOrder: sortMetrics_(metricOrder.map(canonicalizeMetric_).filter(function(metric) {
			return shouldExposeMetricInSheetMetricOrder_(metric);
		})),
		storeNames: storeNames,
		records: normalizeRecords_(records, metricOrder, months, storeNames),
		presence: normalizePresence_(presence),
	};
}

function normalizeMetricSheetRequestedStoreIds_(storeIds) {
	if (!Array.isArray(storeIds) || !storeIds.length) {
		return [];
	}

	const requestedIndex = {};
	return storeIds.reduce(function(result, storeId) {
		const normalizedStoreId = String(storeId || '').trim();
		if (!normalizedStoreId || requestedIndex[normalizedStoreId]) {
			return result;
		}
		requestedIndex[normalizedStoreId] = true;
		result.push(normalizedStoreId);
		return result;
	}, []);
}

function getMetricSheetValuesForStoreIds_(sheet, storeIds) {
	const lastRow = sheet.getLastRow();
	const lastColumn = sheet.getLastColumn();
	if (lastRow < 1 || lastColumn < 1) {
		return [];
	}

	const values = [sheet.getRange(1, 1, 1, lastColumn).getValues()[0]];
	if (lastRow < 2) {
		return values;
	}

	const rowRanges = getMetricSheetStoreRowRanges_(sheet, storeIds, lastRow);
	rowRanges.forEach(function(range) {
		const blockValues = sheet.getRange(range.startRow, 1, range.rowCount, lastColumn).getValues();
		Array.prototype.push.apply(values, blockValues);
	});

	return values;
}

function getMetricSheetStoreRowRanges_(sheet, storeIds, lastRow) {
	const requestedStoreIndex = storeIds.reduce(function(index, storeId) {
		index[storeId] = true;
		return index;
	}, {});
	const storeColumnValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
	const ranges = [];
	let currentStoreId = '';
	let activeRange = null;

	for (let offset = 0; offset < storeColumnValues.length; offset += 1) {
		const rowNumber = offset + 2;
		const rowStoreId = String(storeColumnValues[offset][0] || '').trim();

		if (rowStoreId && rowStoreId !== currentStoreId) {
			if (activeRange) {
				activeRange.rowCount = rowNumber - activeRange.startRow;
				ranges.push(activeRange);
				activeRange = null;
			}

			currentStoreId = rowStoreId;
			if (requestedStoreIndex[currentStoreId]) {
				activeRange = {
					startRow: rowNumber,
					rowCount: 0,
				};
			}
		}
	}

	if (activeRange) {
		activeRange.rowCount = (lastRow + 1) - activeRange.startRow;
		ranges.push(activeRange);
	}

	return ranges;
}

function shouldExposeMetricInSheetMetricOrder_(metric) {
	const canonicalMetric = canonicalizeMetric_(metric);
	if (!canonicalMetric) {
		return false;
	}

	if (EXCLUDED_METRICS.indexOf(canonicalMetric) > -1) {
		return false;
	}

	if (isWorkforceStructureBandMetric_(canonicalMetric)) {
		return false;
	}

	if (isLongAbsenceWorkforceBandMetric_(canonicalMetric)) {
		return false;
	}

	const normalizedMetric = normalizeText_(canonicalMetric).replace(/\s+/g, ' ');
	return normalizedMetric.indexOf('pr %') === -1 && normalizedMetric.indexOf('pr%') === -1;
}

function getPlanCsvMetricData_() {
	const folder = getPlanCsvFolder_();
	const fileIterator = folder.getFiles();
	const sourceMonths = [];
	const monthIndex = {};
	const metricOrder = [];
	const records = {};
	const presence = {};
	const storeNames = getLegacyPlanStoreNames_();
	let fileCount = 0;

	while (fileIterator.hasNext()) {
		const file = fileIterator.next();
		if (!isPlanCsvFile_(file)) {
			continue;
		}

		fileCount += 1;
		const parsedFile = parsePlanCsvFile_(file);
		const storeId = parsedFile.storeId;
		if (!storeId) {
			throw new Error('Nepodarilo sa urcit filialku zo suboru ' + file.getName() + '.');
		}

		if (!Object.prototype.hasOwnProperty.call(storeNames, storeId)) {
			storeNames[storeId] = sanitizeStoreName_(storeId, parsedFile.storeName || '');
		}

		parsedFile.months.forEach(function(month) {
			if (!monthIndex[month]) {
				monthIndex[month] = true;
				sourceMonths.push(month);
			}
		});

		parsedFile.rows.forEach(function(row) {
			const canonicalMetric = canonicalizeMetric_(row.metric);
			if (!shouldImportPlanCsvMetric_(canonicalMetric)) {
				return;
			}

			if (shouldExposePlanCsvMetric_(canonicalMetric) && metricOrder.indexOf(canonicalMetric) === -1) {
				metricOrder.push(canonicalMetric);
			}

			parsedFile.months.forEach(function(month, monthPosition) {
				const numericCell = parsePlanCsvNumber_(row.values[monthPosition]);
				const key = buildKey_(storeId, canonicalMetric, month);
				records[key] = numericCell.value;
				presence[key] = numericCell.present;
			});
		});
	}

	if (!fileCount) {
		throw new Error('Vo folderi ' + PLAN_CSV_FOLDER_NAME + ' sa nenasli ziadne CSV subory s planom.');
	}

	const months = sortMonthsForBusinessYear_(sourceMonths);
	return {
		months: months,
		metricOrder: sortMetrics_(metricOrder),
		storeNames: storeNames,
		records: normalizeRecords_(records, metricOrder, months, storeNames),
		presence: normalizePresence_(presence),
	};
}

function getPlanCsvFolder_() {
	const spreadsheetFile = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
	const parents = spreadsheetFile.getParents();

	while (parents.hasNext()) {
		const parent = parents.next();
		const folders = parent.getFoldersByName(PLAN_CSV_FOLDER_NAME);
		if (folders.hasNext()) {
			return folders.next();
		}
	}

	const globalMatches = DriveApp.getFoldersByName(PLAN_CSV_FOLDER_NAME);
	if (globalMatches.hasNext()) {
		return globalMatches.next();
	}

	throw new Error('Folder ' + PLAN_CSV_FOLDER_NAME + ' sa nenasiel vedla spreadsheetu ani na Drive.');
}

function isPlanCsvFile_(file) {
	const name = String(file.getName() || '').trim();
	return name.toLowerCase().slice(-4) === '.csv' && name.indexOf(PLAN_CSV_FILE_PREFIX) === 0;
}

function parsePlanCsvFile_(file) {
	const rawText = readPlanCsvText_(file).replace(/^\ufeff/, '');
	const rows = Utilities.parseCsv(rawText, ';').filter(function(row) {
		return row.some(function(cell) {
			return String(cell || '').trim() !== '';
		});
	});

	if (rows.length < 2) {
		throw new Error('CSV subor ' + file.getName() + ' nema dostatok dat.');
	}

	const months = rows[0].slice(1).filter(function(month) {
		return String(month || '').trim() !== '';
	}).map(function(month) {
		return String(month).trim();
	});
	const resolvedRows = resolvePlanCsvRows_(rows.slice(1), months.length);

	return {
		storeId: extractStoreIdFromPlanCsvFileName_(file.getName()),
		storeName: '',
		months: months,
		rows: resolvedRows,
	};
}

function resolvePlanCsvRows_(rows, monthCount) {
	const resolvedRows = [];
	let activeMetric = '';

	(rows || []).forEach(function(row) {
		const rawMetric = String(row[0] || '').trim();
		if (!rawMetric) {
			return;
		}

		const resolvedMetric = resolvePlanCsvMetricName_(rawMetric, activeMetric);
		if (!resolvedMetric) {
			return;
		}

		if (!isPlanCsvBandMetricIdentifier_(rawMetric)) {
			activeMetric = resolvedMetric;
		}

		resolvedRows.push({
			metric: resolvedMetric,
			values: row.slice(1, monthCount + 1),
		});
	});

	return resolvedRows;
}

function resolvePlanCsvMetricName_(rawMetric, activeMetric) {
	const directMetric = canonicalizeMetric_(rawMetric);
	if (isRecognizedPlanCsvMetric_(directMetric)) {
		return directMetric;
	}

	const matchedBand = getWorkforceBandByCsvIdentifier_(rawMetric);
	if (!matchedBand) {
		return directMetric;
	}

	if (canonicalizeMetric_(activeMetric) === LONG_ABSENCE_METRIC) {
		return getLongAbsenceBandMetricKey_(matchedBand.label);
	}

	return matchedBand.key;
}

function isRecognizedPlanCsvMetric_(metric) {
	const canonicalMetric = canonicalizeMetric_(metric);
	return isTrackedPlanMetric_(canonicalMetric)
		|| isWorkforceStructureBandMetric_(canonicalMetric)
		|| isLongAbsenceWorkforceBandMetric_(canonicalMetric);
}

function isPlanCsvBandMetricIdentifier_(rawMetric) {
	return Boolean(getWorkforceBandByCsvIdentifier_(rawMetric));
}

function getWorkforceBandByCsvIdentifier_(rawMetric) {
	const parsed = parsePlanCsvNumber_(rawMetric);
	if (!parsed.present) {
		return null;
	}

	for (let index = 0; index < WORKFORCE_STRUCTURE_BANDS.length; index += 1) {
		const band = WORKFORCE_STRUCTURE_BANDS[index];
		const expectedRatio = band.hoursWeight / FULL_TIME_DAILY_HOURS;
		if (Math.abs(parsed.value - expectedRatio) < 0.003 || Math.abs(parsed.value - band.fteWeight) < 0.03) {
			return band;
		}
	}

	return null;
}

function readPlanCsvText_(file) {
	const blob = file.getBlob();
	const encodings = ['UTF-16LE', 'UTF-16', 'UTF-8'];

	for (let index = 0; index < encodings.length; index += 1) {
		const text = blob.getDataAsString(encodings[index]);
		if (text && text.indexOf(';') > -1) {
			return text;
		}
	}

	return blob.getDataAsString();
}

function extractStoreIdFromPlanCsvFileName_(fileName) {
	const match = String(fileName || '').match(/^LogGF_Dane_Struk_(\d+)_/i);
	if (match && match[1]) {
		return String(match[1]).trim();
	}

	const fallbackMatch = String(fileName || '').match(/(\d{3,5})/);
	return fallbackMatch && fallbackMatch[1] ? String(fallbackMatch[1]).trim() : '';
}

function shouldImportPlanCsvMetric_(metric) {
	if (!metric) {
		return false;
	}

	const normalizedMetric = normalizeText_(metric).replace(/\s+/g, ' ');
	if (normalizedMetric.indexOf('pr %') > -1 || normalizedMetric.indexOf('pr%') > -1) {
		return false;
	}

	if (isWorkforceStructureBandMetric_(metric)) {
		return true;
	}

	if (isLongAbsenceWorkforceBandMetric_(metric)) {
		return true;
	}

	return isTrackedPlanMetric_(metric);
}

function shouldExposePlanCsvMetric_(metric) {
	return shouldImportPlanCsvMetric_(metric)
		&& !isWorkforceStructureBandMetric_(metric)
		&& !isLongAbsenceWorkforceBandMetric_(metric);
}

function isTrackedPlanMetric_(metric) {
	const canonicalMetric = canonicalizeMetric_(metric);
	return Object.prototype.hasOwnProperty.call(METRIC_ALIASES, canonicalMetric)
		|| UI_METRIC_ORDER.indexOf(canonicalMetric) > -1
		|| PRIMARY_METRICS.indexOf(canonicalMetric) > -1
		|| REQUIRED_DERIVED_METRICS.indexOf(canonicalMetric) > -1
		|| NET_HOURS_COMPONENT_METRICS.indexOf(canonicalMetric) > -1
		|| EXCLUDED_METRICS.indexOf(canonicalMetric) > -1;
}

function isWorkforceStructureBandMetric_(metric) {
	const canonicalMetric = canonicalizeMetric_(metric);
	return WORKFORCE_STRUCTURE_BANDS.some(function(band) {
		return band.key === canonicalMetric;
	});
}

function isLongAbsenceWorkforceBandMetric_(metric) {
	const canonicalMetric = canonicalizeMetric_(metric);
	return LONG_ABSENCE_WORKFORCE_BANDS.some(function(band) {
		return band.key === canonicalMetric;
	});
}

function getLongAbsenceBandMetricKey_(bandLabel) {
	return 'Dlhodobá neprítomnosť ' + String(bandLabel || '').trim();
}

function parsePlanCsvNumber_(rawValue) {
	if (typeof rawValue === 'number') {
		return {
			value: isNaN(rawValue) ? 0 : rawValue,
			present: true,
		};
	}

	const text = String(rawValue == null ? '' : rawValue).trim();
	if (!text) {
		return { value: 0, present: false };
	}

	const normalized = text
		.replace(/\s+/g, '')
		.replace(/\.(?=\d{3}(?:\D|$))/g, '')
		.replace(',', '.');
	const parsed = Number(normalized);
	return {
		value: isNaN(parsed) ? 0 : parsed,
		present: true,
	};
}

function getLegacyPlanStoreNames_() {
	const structureStoreNames = getStructureStoreNames_();
	const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
	const sheet = spreadsheet.getSheetByName(LEGACY_PLAN_STORE_SOURCE_SHEET_NAME) || spreadsheet.getSheetByName(SHEET_NAMES.PLAN);
	if (!sheet) {
		return structureStoreNames;
	}

	const values = sheet.getDataRange().getValues();
	const storeNames = {};
	let currentStoreId = '';
	let currentStoreName = '';

	for (let row = 1; row < values.length; row += 1) {
		if (values[row][0]) {
			currentStoreId = String(values[row][0]).trim();
		}
		if (values[row][1]) {
			currentStoreName = String(values[row][1]).trim();
		}
		if (currentStoreId && !Object.prototype.hasOwnProperty.call(storeNames, currentStoreId)) {
			storeNames[currentStoreId] = sanitizeStoreName_(currentStoreId, currentStoreName);
		}
	}

	Object.keys(structureStoreNames).forEach(function(storeId) {
		storeNames[storeId] = structureStoreNames[storeId] || storeNames[storeId] || '';
	});

	return storeNames;
}

function getStructureStoreNames_() {
	const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.STRUCTURE);
	if (!sheet) {
		return {};
	}

	const values = sheet.getDataRange().getValues();
	const storeNames = {};

	for (let row = 1; row < values.length; row += 1) {
		const storeId = String(values[row][2] || '').trim();
		const storeName = String(values[row][3] || '').trim();
		if (!storeId || !storeName) {
			continue;
		}
		storeNames[storeId] = sanitizeStoreName_(storeId, storeName);
	}

	return storeNames;
}

function resolveScope(user, selectedScope, structure, storeNames) {
	const allowedStores = user.accessibleStoreIds.slice();
	const scopeValue = String(selectedScope || '').trim();

	if (!scopeValue || scopeValue === 'ALL') {
		if (user.role === 'VOD') {
			const storeId = user.primaryStoreId;
			return {
				id: storeId,
				type: 'STORE',
				label: buildStoreDisplayLabel_(storeId, storeNames[storeId]),
				storeIds: [storeId],
			};
		}

		return {
			id: 'ALL',
			type: 'AGGREGATE',
			label: user.role === 'GF' ? 'Sumar GF' : 'Sumar VKL',
			storeIds: allowedStores,
		};
	}

	if (allowedStores.indexOf(scopeValue) === -1) {
		throw new Error('Nemáš prístup k zvolenému scope.');
	}

	return {
		id: scopeValue,
		type: 'STORE',
		label: buildStoreDisplayLabel_(scopeValue, storeNames[scopeValue]),
		storeIds: [scopeValue],
	};
}

function buildAvailableScopes(user, structure, storeNames) {
	const scopes = [];

	if (user.role !== 'VOD') {
		scopes.push({ id: 'ALL', label: user.role === 'GF' ? 'Sumar GF' : 'Sumar VKL', type: 'AGGREGATE' });
	}

	user.accessibleStoreIds.forEach(function(storeId) {
		scopes.push({
			id: storeId,
			label: buildStoreDisplayLabel_(storeId, storeNames[storeId]),
			type: 'STORE',
		});
	});

	return scopes;
}

/**
 * Computes a single metric × month cell with plan/real/forecast/variance values.
 * Dispatches to specialised logic per metric type (static, gross hours, structure-driven, net hours, etc.).
 * @param {string} metric - Metric constant (e.g. OBRAT_METRIC)
 * @param {string[]} storeIds - Store IDs in scope
 * @param {string} month - Month label (e.g. '03/2026')
 * @param {number} monthIndex - 0-based month position in the business year
 * @param {Object} planData - Plan sheet records/presence
 * @param {Object} realData - IST sheet records/presence
 * @param {Object} vodData - VOD adjustment records/presence
 * @returns {{plan:number,real:number,adjustment:number,forecast:number,variance:number,variancePct:number,closedMonth:boolean,hasRealData:boolean}}
 */
function buildMetricMonthCell_(metric, storeIds, month, monthIndex, planData, realData, vodData) {
	const closedMonth = isClosedMonth_(month);
	const hasRealData = hasRealDataForMetric_(storeIds, realData.presence, realData.records, metric, month, closedMonth);

	if (metric === WORKING_DAYS_METRIC || metric === CLOSED_HOLIDAY_METRIC) {
		const staticValue = getHardcodedMetricValue_(metric, month, monthIndex);
		return {
			plan: staticValue, real: staticValue, adjustment: 0,
			forecast: staticValue, variance: 0, variancePct: 0,
			closedMonth: false, hasRealData: true,
		};
	}

	if (metric === GROSS_HOURS_METRIC) {
		const plan = calculateGrossHoursForStores_(storeIds, planData.records, month);
		const real = calculateGrossHoursActualForStores_(storeIds, realData.records, month, realData.presence);
		const forecastValue = closedMonth
			? real
			: calculateGrossHoursForecastForStores_(storeIds, planData.records, vodData.records, month, vodData.presence);
		const varianceValue = forecastValue - plan;
		return {
			plan: roundMetric_(metric, plan), real: roundMetric_(metric, real),
			adjustment: roundMetric_(metric, closedMonth ? 0 : forecastValue - plan),
			forecast: roundMetric_(metric, forecastValue),
			variance: roundMetric_(metric, varianceValue),
			variancePct: plan ? varianceValue / plan : 0,
			closedMonth: closedMonth, hasRealData: hasRealData,
		};
	}

	if (isStructureDrivenMetric_(metric)) {
		const plan = getStructureDrivenPlan_(storeIds, planData.records, metric, month);
		const real = hasRealData
			? getStructureDrivenActual_(storeIds, realData.records, realData.presence, metric, month)
			: 0;
		const forecastValue = calculateStructureDrivenForecast_(storeIds, planData.records, vodData.records, metric, month, vodData.presence);
		const adjustment = forecastValue - plan;
		const varianceValue = forecastValue - plan;
		return {
			plan: roundMetric_(metric, plan), real: roundMetric_(metric, real),
			adjustment: roundMetric_(metric, adjustment),
			forecast: roundMetric_(metric, forecastValue),
			variance: roundMetric_(metric, varianceValue),
			variancePct: plan ? varianceValue / plan : 0,
			closedMonth: false, hasRealData: hasRealData,
		};
	}

	if (metric === NET_HOURS_METRIC) {
		const planValue = getPlanNetHoursBaselineForStores_(storeIds, planData.records, month);
		const realValue = getRealNetHoursForStores_(storeIds, realData.records, month, realData.presence);
		const formulaPlan = calculateNetHoursForStores_(storeIds, planData.records, month);
		const formulaForecast = calculateNetHoursForecastForStores_(storeIds, planData.records, vodData.records, month, vodData.presence);
		const vodImpact = formulaForecast - formulaPlan;
		const forecastValue = closedMonth ? realValue : planValue + vodImpact;
		const varianceValue = forecastValue - planValue;
		return {
			plan: roundMetric_(metric, planValue), real: roundMetric_(metric, realValue),
			adjustment: roundMetric_(metric, closedMonth ? 0 : vodImpact),
			forecast: roundMetric_(metric, forecastValue),
			variance: roundMetric_(metric, varianceValue),
			variancePct: planValue ? varianceValue / planValue : 0,
			closedMonth: closedMonth, hasRealData: hasRealData,
		};
	}

	let plan = 0;
	let real = 0;
	let adjustment = 0;
	storeIds.forEach(function(storeId) {
		plan += getRecordValue_(planData.records, storeId, metric, month);
		real += getRecordValue_(realData.records, storeId, metric, month);
		adjustment += getRecordValue_(vodData.records, storeId, metric, month);
	});

	if (metric === CLEAN_PERFORMANCE_METRIC) {
		plan = calculateCleanPerformance_(storeIds, planData.records, month);
		real = calculateRealCleanPerformance_(storeIds, realData.records, month, realData.presence);
		adjustment = 0;
	}

	const forecast = metric === CLEAN_PERFORMANCE_METRIC
		? calculateDerivedForecastCleanPerformance_(storeIds, planData.records, realData.records, realData.presence, vodData.records, month, closedMonth, vodData.presence)
		: (closedMonth ? real : plan + adjustment);
	const variance = forecast - plan;
	const variancePct = plan ? variance / plan : 0;

	return {
		plan: roundMetric_(metric, plan), real: roundMetric_(metric, real),
		adjustment: roundMetric_(metric, adjustment),
		forecast: roundMetric_(metric, forecast),
		variance: roundMetric_(metric, variance), variancePct: variancePct,
		closedMonth: closedMonth, hasRealData: hasRealData,
	};
}

/**
 * Builds the full metric × month data matrix for a scope (store, region, or area).
 * @param {string[]} storeIds - Store IDs in scope
 * @param {string[]} months - Ordered month labels for the business year
 * @param {Object} planData - Plan sheet data (records, metricOrder, storeNames)
 * @param {Object} realData - IST sheet data (records, presence)
 * @param {Object} vodData - VOD adjustment data (records, presence)
 * @returns {{rows:Object, metricOrder:string[]}}
 */
function buildScopeDataset(storeIds, months, planData, realData, vodData) {
	const metricOrder = getScopeMetricOrder_(planData.metricOrder);
	const rows = {};

	metricOrder.forEach(function(metric) {
		rows[metric] = {};
		months.forEach(function(month, monthIndex) {
			rows[metric][month] = buildMetricMonthCell_(metric, storeIds, month, monthIndex, planData, realData, vodData);
		});
	});

	return { rows: rows, metricOrder: metricOrder };
}

function ensureDerivedMetrics_(metricOrder) {
	const metrics = metricOrder.slice();
	REQUIRED_DERIVED_METRICS.forEach(function(metric) {
		if (metrics.indexOf(metric) === -1) {
			metrics.push(metric);
		}
	});
	return metrics;
}

function getScopeMetricOrder_(metricOrder) {
	return sortMetrics_(ensureDerivedMetrics_(collapseMetricOrderForDisplay_(metricOrder)));
}

function collapseMetricOrderForDisplay_(metricOrder) {
	const collapsed = [];
	(metricOrder || []).forEach(function(metric) {
		const collapsedMetric = collapseShortTermPnMetric_(metric);
		if (!collapsedMetric || collapsed.indexOf(collapsedMetric) > -1) {
			return;
		}
		collapsed.push(collapsedMetric);
	});
	return collapsed;
}

function collapseShortTermPnMetric_(metric) {
	const canonicalMetric = canonicalizeMetric_(metric);
	if (canonicalMetric === SHORT_TERM_PN_METRIC || isShortTermPnSourceMetric_(canonicalMetric)) {
		return SHORT_TERM_PN_METRIC;
	}
	return canonicalMetric;
}

function isShortTermPnSourceMetric_(metric) {
	const canonicalMetric = canonicalizeMetric_(metric);
	return SHORT_TERM_PN_SOURCE_METRICS.indexOf(canonicalMetric) > -1;
}

function isShortTermPnMetric_(metric) {
	return canonicalizeMetric_(metric) === SHORT_TERM_PN_METRIC;
}

function buildCards(dataset, months) {
	return PRIMARY_METRICS.map(function(metric) {
		const metricRow = getMetricRow_(dataset.rows, metric, months);
		const totals = summarizeMetric_(metric, metricRow, months);
		return {
			metric: metric,
			plan: totals.plan,
			forecast: totals.forecast,
			real: totals.real,
			variance: roundMetric_(metric, totals.forecast - totals.plan),
			variancePct: totals.plan ? (totals.forecast - totals.plan) / totals.plan : 0,
			format: getMetricFormat_(metric),
		};
	});
}

function buildCharts(dataset, months) {
	const turnoverRow = getMetricRow_(dataset.rows, OBRAT_METRIC, months);
	const hoursRow = getMetricRow_(dataset.rows, NET_HOURS_METRIC, months);
	const performanceRow = getMetricRow_(dataset.rows, CLEAN_PERFORMANCE_METRIC, months);
	const hourStructureRow = getMetricRow_(dataset.rows, STRUCTURE_HOURS_METRIC, months);

	return {
		obrat: buildChartSeries_(turnoverRow, months, 'currency'),
		hours: buildChartSeries_(hoursRow, months, 'hours'),
		performance: buildChartSeries_(performanceRow, months, 'number'),
		workforce: {
			labels: months,
			hoursStructure: months.map(function(month) { return hourStructureRow[month].forecast; }),
		},
	};
}


function buildTable(dataset, months, scope, planData, realData, vodData, precomputedStoreDatasets) {
	const storeDatasets = precomputedStoreDatasets || {};
	if (scope.type === 'AGGREGATE' && scope.storeIds.length > 1) {
		scope.storeIds.forEach(function(storeId) {
			if (!storeDatasets[storeId]) {
				storeDatasets[storeId] = buildScopeDataset([storeId], months, planData, realData, vodData);
			}
		});
	}

	return dataset.metricOrder.reduce(function(sections, metric) {
		if (isHiddenTableMetric_(metric)) {
			return sections;
		}

		const metricRow = getMetricRow_(dataset.rows, metric, months);
		const totals = summarizeMetric_(metric, metricRow, months);
		const adjustmentTotal = months.reduce(function(sum, month) {
			return sum + metricRow[month].adjustment;
		}, 0);
		const deltaRow = buildSmartDeltaRow_(metric, metricRow, months);
		const rows = metric === WORKFORCE_STRUCTURE_METRIC
			? buildWorkforceStructureSectionRows_(scope.storeIds, months, dataset.rows, planData.records, realData.records, realData.presence, vodData.records, vodData.presence)
			: metric === GROSS_HOURS_METRIC
				? buildGrossHoursSectionRows_(scope.storeIds, months, dataset.rows, planData.records, realData.records, vodData.records)
			: buildDefaultMetricRows_(metric, metricRow, totals, adjustmentTotal, deltaRow, scope.storeIds, months, vodData.records);

		sections.push({
			metric: metric,
			format: getMetricFormat_(metric),
			rows: rows,
			breakdown: buildMetricBreakdown_(metric, months, scope, storeDatasets, planData.storeNames, planData.records, realData.records, realData.presence, vodData.records, vodData.presence),
		});

		return sections;
	}, []);
}

function buildMetricBreakdown_(metric, months, scope, storeDatasets, storeNames, planRecords, realRecords, realPresence, vodRecords, vodPresence) {
	if (scope.type !== 'AGGREGATE' || scope.storeIds.length <= 1) {
		return [];
	}

	return scope.storeIds.map(function(storeId) {
		const storeDataset = storeDatasets[storeId];
		const metricRow = getMetricRow_(storeDataset.rows, metric, months);
		const totals = summarizeMetric_(metric, metricRow, months);
		const adjustmentTotal = months.reduce(function(sum, month) {
			return sum + metricRow[month].adjustment;
		}, 0);
		const deltaRow = buildSmartDeltaRow_(metric, metricRow, months);
		const rows = metric === WORKFORCE_STRUCTURE_METRIC
			? buildWorkforceStructureSectionRows_([storeId], months, storeDataset.rows, planRecords, realRecords, realPresence, vodRecords, vodPresence)
			: metric === GROSS_HOURS_METRIC
				? buildGrossHoursSectionRows_([storeId], months, storeDataset.rows, planRecords, realRecords, vodRecords)
			: buildDefaultMetricRows_(metric, metricRow, totals, adjustmentTotal, deltaRow, [storeId], months, vodRecords);
		const forecastTotal = metric === WORKFORCE_STRUCTURE_METRIC
			? summarizeMetric_(STRUCTURE_HOURS_METRIC, getMetricRow_(storeDataset.rows, STRUCTURE_HOURS_METRIC, months), months).forecast
			: metric === GROSS_HOURS_METRIC
				? sumValues_(buildGrossHoursSectionRows_([storeId], months, storeDataset.rows, planRecords, realRecords, vodRecords)[0].values)
			: totals.forecast;

		return {
			storeId: storeId,
			storeName: storeNames[storeId] || '',
			forecastTotal: forecastTotal,
			rows: rows,
		};
	}).sort(function(left, right) {
		return right.forecastTotal - left.forecastTotal;
	});
}

function buildDefaultMetricRows_(metric, metricRow, totals, adjustmentTotal, deltaRow, storeIds, months, vodRecords) {
	const mixRow = isStructureDrivenMetric_(metric)
		? buildWorkforceStructureMixRow_(storeIds, months, vodRecords)
		: null;
	const realValues = months.map(function(month) {
		return getDisplayedIstValue_(metric, metricRow[month]);
	});
	const realTotal = summarizeDisplayedValues_(metric, realValues);
	const rows = [
		{ type: 'plan', label: getMetricRowDisplayLabel_('plan'), values: months.map(function(month) { return metricRow[month].plan; }), total: totals.plan },
	];

	if (isStructureDrivenMetric_(metric)) {
		rows.push(mixRow);
	} else {
		rows.push({
			type: 'real',
			label: getMetricRowDisplayLabel_('real'),
			values: realValues,
			actualValues: months.map(function(month) { return metricRow[month].real; }),
			hasRealFlags: months.map(function(month) { return Boolean(metricRow[month].hasRealData); }),
			total: realTotal,
			actualTotal: totals.real,
		});
		rows.push({ type: 'adjustment', label: getMetricRowDisplayLabel_('adjustment'), values: months.map(function(month) { return metricRow[month].adjustment; }), closed: months.map(function(month) { return metricRow[month].closedMonth; }), total: roundMetric_(metric, adjustmentTotal) });
	}

	rows.push({ type: 'forecast', label: getMetricRowDisplayLabel_('forecast'), values: months.map(function(month) { return metricRow[month].forecast; }), total: totals.forecast });
	rows.push(deltaRow);
	return rows;
}

function buildWorkforceStructureDisplayModel_(storeIds, months, datasetRows, planRecords, realRecords, realPresence, vodRecords, vodPresence) {
	const workingDaysRow = getMetricRow_(datasetRows, WORKING_DAYS_METRIC, months);
	const holidayRow = getMetricRow_(datasetRows, CLOSED_HOLIDAY_METRIC, months);
	const structureHoursMetricRow = getMetricRow_(datasetRows, STRUCTURE_HOURS_METRIC, months);
	const mixValues = months.map(function(month) {
		const effectiveMix = getEffectiveWorkforceStructureMixForStores_(storeIds, planRecords || {}, vodRecords || {}, month, vodPresence || {});
		const planMix = getWorkforceStructureMixForStores_(storeIds, planRecords || {}, month);
		const realMix = Boolean(structureHoursMetricRow[month].hasRealData)
			? getActualWorkforceStructureMixForStores_(storeIds, realRecords || {}, month, realPresence || {})
			: buildEmptyWorkforceStructureMix_();
		return mergeWorkforceStructureMixReferences_(effectiveMix, planMix, realMix);
	});
	const structureHoursPlanValues = months.map(function(month) {
		return roundMetric_(STRUCTURE_HOURS_METRIC,
			calculateStructureHoursPlanForStores_(storeIds, planRecords || {}, month)
		);
	});
	const structureHoursRealValues = months.map(function(month) {
		return Boolean(structureHoursMetricRow[month].hasRealData)
			? roundMetric_(STRUCTURE_HOURS_METRIC, Number(structureHoursMetricRow[month].real || 0))
			: null;
	});
	const workforceValues = months.map(function(month) {
		return roundMetric_(WORKFORCE_STRUCTURE_METRIC,
			calculateWorkforceStructureForecastForStores_(storeIds, planRecords || {}, vodRecords || {}, month, vodPresence || {})
		);
	});
	const structureHoursValues = months.map(function(month) {
		return roundMetric_(STRUCTURE_HOURS_METRIC,
			calculateStructureHoursForecastForStores_(storeIds, planRecords || {}, vodRecords || {}, month, vodPresence || {})
		);
	});
	const workforceAverageTotal = roundMetric_(WORKFORCE_STRUCTURE_METRIC, averageValues_(workforceValues));
	const structureHoursTotal = roundMetric_(STRUCTURE_HOURS_METRIC, sumValues_(structureHoursValues));

	return {
		workingDaysValues: months.map(function(month) { return workingDaysRow[month].plan; }),
		holidayValues: months.map(function(month) { return holidayRow[month].plan; }),
		mixValues: mixValues,
		structureHoursPlanValues: structureHoursPlanValues,
		structureHoursRealValues: structureHoursRealValues,
		structureHoursRealFlags: months.map(function(month) { return Boolean(structureHoursMetricRow[month].hasRealData); }),
		workforceValues: workforceValues,
		structureHoursValues: structureHoursValues,
		workforceAverageTotal: workforceAverageTotal,
		structureHoursRealTotal: roundMetric_(STRUCTURE_HOURS_METRIC, sumValues_(structureHoursRealValues.filter(function(value) {
			return value != null;
		}))),
		structureHoursPlanTotal: roundMetric_(STRUCTURE_HOURS_METRIC, sumValues_(structureHoursPlanValues)),
		structureHoursTotal: structureHoursTotal,
	};
}

function buildWorkforceStructureSectionRows_(storeIds, months, datasetRows, planRecords, realRecords, realPresence, vodRecords, vodPresence) {
	const displayModel = buildWorkforceStructureDisplayModel_(storeIds, months, datasetRows, planRecords, realRecords, realPresence, vodRecords, vodPresence);

	return [
		{
			type: 'static-plan',
			label: WORKING_DAYS_METRIC,
			values: displayModel.workingDaysValues,
			total: sumValues_(displayModel.workingDaysValues),
			displayFormat: 'number',
		},
		{
			type: 'static-plan',
			label: CLOSED_HOLIDAY_METRIC,
			values: displayModel.holidayValues,
			total: sumValues_(displayModel.holidayValues),
			displayFormat: 'number',
		},
		{
			type: 'workforce-total',
			label: 'Štruktúra plné úväzky',
			values: displayModel.workforceValues,
			total: displayModel.workforceAverageTotal,
			displayFormat: 'fte',
		},
		{
			type: 'structure-mix',
			label: 'Počty úväzkov',
			values: displayModel.mixValues,
			total: '',
		},
		{
			type: 'structure-hours-derived',
			label: 'Štruktúra hodín',
			values: displayModel.structureHoursValues,
			total: displayModel.structureHoursTotal,
			displayFormat: 'hours',
		},
		{
			type: 'structure-hours-real',
			label: 'Štruktúra hodín IST',
			values: displayModel.structureHoursRealValues,
			hasRealFlags: displayModel.structureHoursRealFlags,
			total: displayModel.structureHoursRealTotal,
			displayFormat: 'hours',
		},
		{
			type: 'structure-hours-plan',
			label: 'Štruktúra hodín plan',
			values: displayModel.structureHoursPlanValues,
			total: displayModel.structureHoursPlanTotal,
			displayFormat: 'hours',
		},
	];
}

function hasWorkforceStructureMixData_(mix) {
	return Boolean(mix && Array.isArray(mix.bands) && mix.bands.some(function(band) {
		return Math.abs(Number(band.count || 0)) > 0.0001;
	}));
}


function buildGrossHoursSectionRows_(storeIds, months, datasetRows, planRecords, realRecords, vodRecords) {
	const longAbsenceRow = getMetricRow_(datasetRows, LONG_ABSENCE_METRIC, months);
	const planValues = months.map(function(month) {
		return roundMetric_(GROSS_HOURS_METRIC,
			calculateStructureHoursPlanForStores_(storeIds, planRecords || {}, month) - Number(longAbsenceRow[month].plan || 0)
		);
	});
	const realValues = months.map(function(month) {
		return roundMetric_(GROSS_HOURS_METRIC,
			calculateStructureHoursActualForStores_(storeIds, realRecords || {}, month) - Number(longAbsenceRow[month].real || 0)
		);
	});

	return [
		{
			type: 'plan',
			label: 'Výsledok Štruktúra hodín - dlhodobá neprítomnosť Plan',
			values: planValues,
			total: sumValues_(planValues),
		},
		{
			type: 'real',
			label: 'Výsledok Štruktúra hodín - dlhodobá neprítomnosť IST',
			values: realValues,
			total: sumValues_(realValues),
		},
	];
}

function buildWorkforceStructureMixRow_(storeIds, months, vodRecords) {
	return {
		type: 'structure-mix',
		label: 'Počty úväzkov',
		values: months.map(function(month) {
			return getWorkforceStructureMixForStores_(storeIds, vodRecords, month);
		}),
		closed: months.map(function() { return false; }),
		total: '',
	};
}

function buildSmartDeltaRow_(metric, metricRow, months) {
	const values = months.map(function(month) {
		return getMetricDeltaValue_(metric, metricRow[month].plan, metricRow[month].real, metricRow[month].hasRealData, metricRow[month].forecast);
	});
	const total = summarizeSummaryMetricTotal_(metric, values);

	return {
		type: 'delta',
		label: getMetricRowDisplayLabel_('delta'),
		values: values,
		total: total,
	};
}

function getMetricRowDisplayLabel_(rowType) {
	switch (rowType) {
		case 'plan':
			return DISPLAY_PLAN_LABEL;
		case 'real':
			return DISPLAY_REAL_LABEL;
		case 'adjustment':
			return VOD_INPUT_LABEL;
		case 'forecast':
			return DISPLAY_FORECAST_LABEL;
		case 'delta':
			return DISPLAY_DELTA_LABEL;
		default:
			return rowType;
	}
}

function getMetricDeltaValue_(metric, planValue, actualValue, hasActual, forecastValue) {
	return roundMetric_(metric, Number(forecastValue || 0) - Number(hasActual ? actualValue : planValue || 0));
}

function getDisplayedIstValue_(metric, monthState) {
	const state = monthState || {};
	if (state.hasRealData) {
		return Number(state.real || 0);
	}

	if (shouldUsePlanInIstRow_(metric)) {
		return Number(state.plan || 0);
	}

	return Number(state.real || 0);
}

function summarizeDisplayedValues_(metric, values) {
	if (canonicalizeMetric_(metric) === CLEAN_PERFORMANCE_METRIC) {
		return roundMetric_(metric, averageValues_(values));
	}

	return roundMetric_(metric, sumValues_(values));
}

function shouldUsePlanInIstRow_(metric) {
	return PLAN_AS_PENDING_DELTA_METRICS.indexOf(canonicalizeMetric_(metric)) > -1;
}

function buildStoreSummary(storeIds, months, planData, realData, vodData, precomputedStoreDatasets) {
	const storeDatasets = precomputedStoreDatasets || {};
	return storeIds.map(function(storeId) {
		const storeDataset = storeDatasets[storeId] || buildScopeDataset([storeId], months, planData, realData, vodData);
		const turnoverRow = getMetricRow_(storeDataset.rows, OBRAT_METRIC, months);
		return {
			storeId: storeId,
			storeName: planData.storeNames[storeId] || '',
			forecastObrat: summarizeMetric_(OBRAT_METRIC, turnoverRow, months).forecast,
		};
	}).sort(function(left, right) {
		return right.forecastObrat - left.forecastObrat;
	});
}

function buildChartSeries_(metricRow, months, format) {
	return {
		labels: months,
		plan: months.map(function(month) { return metricRow[month].plan; }),
		real: months.map(function(month) { return metricRow[month].real; }),
		forecast: months.map(function(month) { return metricRow[month].forecast; }),
		adjustment: months.map(function(month) { return metricRow[month].adjustment; }),
		format: format,
	};
}

function summarizeMetric_(metric, monthRows, months) {
	const averageMetrics = [CLEAN_PERFORMANCE_METRIC];
	if (averageMetrics.indexOf(metric) > -1) {
		const totals = months.reduce(function(acc, month) {
			acc.plan += monthRows[month].plan;
			acc.real += monthRows[month].real;
			acc.forecast += monthRows[month].forecast;
			acc.count += 1;
			return acc;
		}, { plan: 0, real: 0, forecast: 0, count: 0 });
		return {
			plan: roundMetric_(metric, totals.count ? totals.plan / totals.count : 0),
			real: roundMetric_(metric, totals.count ? totals.real / totals.count : 0),
			forecast: roundMetric_(metric, totals.count ? totals.forecast / totals.count : 0),
		};
	}

	return months.reduce(function(acc, month) {
		acc.plan += monthRows[month].plan;
		acc.real += monthRows[month].real;
		acc.forecast += monthRows[month].forecast;
		return acc;
	}, { plan: 0, real: 0, forecast: 0 });
}

function calculateCleanPerformance_(storeIds, records, month) {
	let turnover = 0;
	let hours = 0;

	storeIds.forEach(function(storeId) {
		turnover += getRecordValue_(records, storeId, OBRAT_METRIC, month);
		hours += calculateNetHoursForStore_(storeId, records, month);
	});

	return hours ? turnover / hours : 0;
}

function calculateRealCleanPerformance_(storeIds, records, month, presence) {
	let turnover = 0;
	let hours = 0;

	storeIds.forEach(function(storeId) {
		turnover += getRecordValue_(records, storeId, OBRAT_METRIC, month);
		hours += getRealNetHoursForStore_(storeId, records, month, presence);
	});

	return hours ? turnover / hours : 0;
}

function calculateNetHoursForStores_(storeIds, records, month) {
	return storeIds.reduce(function(sum, storeId) {
		return sum + calculateNetHoursForStore_(storeId, records, month);
	}, 0);
}

function getRealNetHoursForStores_(storeIds, records, month, presence) {
	return storeIds.reduce(function(sum, storeId) {
		return sum + getRealNetHoursForStore_(storeId, records, month, presence);
	}, 0);
}

function getPlanNetHoursBaselineForStores_(storeIds, records, month) {
	const planVtValue = storeIds.reduce(function(sum, storeId) {
		return sum + getRecordValue_(records, storeId, NET_HOURS_PLAN_VT_METRIC, month);
	}, 0);

	if (Math.abs(planVtValue) > 0.0001) {
		return planVtValue;
	}

	return calculateNetHoursForStores_(storeIds, records, month);
}

function getExplicitNetHoursValueForStore_(storeId, records, month, presence) {
	if (presence && hasMetricPresenceForStore_(storeId, presence, NET_HOURS_METRIC, month)) {
		return getRecordValue_(records, storeId, NET_HOURS_METRIC, month);
	}

	if (presence && hasMetricPresenceForStore_(storeId, presence, NET_HOURS_PLAN_VT_METRIC, month)) {
		return getRecordValue_(records, storeId, NET_HOURS_PLAN_VT_METRIC, month);
	}

	const directNetHours = Number(getRecordValue_(records, storeId, NET_HOURS_METRIC, month) || 0);
	if (Math.abs(directNetHours) > 0.0001) {
		return directNetHours;
	}

	const planVtNetHours = Number(getRecordValue_(records, storeId, NET_HOURS_PLAN_VT_METRIC, month) || 0);
	if (Math.abs(planVtNetHours) > 0.0001) {
		return planVtNetHours;
	}

	return null;
}

function getRealNetHoursForStore_(storeId, records, month, presence) {
	const explicitNetHours = getExplicitNetHoursValueForStore_(storeId, records, month, presence);
	if (explicitNetHours != null) {
		return explicitNetHours;
	}

	return calculateNetHoursActualForStore_(storeId, records, month, presence);
}

function calculateNetHoursForecastForStores_(storeIds, planRecords, vodRecords, month, vodPresence) {
	return storeIds.reduce(function(sum, storeId) {
		return sum + calculateNetHoursForecastForStore_(storeId, planRecords, vodRecords, month, vodPresence);
	}, 0);
}

function isStructureDrivenMetric_(metric) {
	return STRUCTURE_DRIVEN_METRICS.indexOf(metric) > -1;
}

function getStructureDrivenPlan_(storeIds, records, metric, month) {
	if (metric === STRUCTURE_HOURS_METRIC) {
		return calculateStructureHoursPlanForStores_(storeIds, records, month);
	}
	if (metric === WORKFORCE_STRUCTURE_METRIC) {
		return getWorkforceStructurePlan_(storeIds, records, month);
	}

	return storeIds.reduce(function(sum, storeId) {
		return sum + getRecordValue_(records, storeId, metric, month);
	}, 0);
}

function getStructureDrivenActual_(storeIds, records, presence, metric, month) {
	if (metric === STRUCTURE_HOURS_METRIC) {
		return calculateStructureHoursActualForStores_(storeIds, records, month, presence);
	}
	if (metric === WORKFORCE_STRUCTURE_METRIC) {
		return getWorkforceStructurePlan_(storeIds, records, month);
	}

	return storeIds.reduce(function(sum, storeId) {
		return sum + getRecordValue_(records, storeId, metric, month);
	}, 0);
}

function calculateStructureDrivenForecast_(storeIds, planRecords, vodRecords, metric, month, vodPresence) {
	if (metric === STRUCTURE_HOURS_METRIC) {
		return calculateStructureHoursForecastForStores_(storeIds, planRecords, vodRecords, month, vodPresence);
	}
	if (metric === WORKFORCE_STRUCTURE_METRIC) {
		return calculateWorkforceStructureForecastForStores_(storeIds, planRecords, vodRecords, month, vodPresence);
	}

	return storeIds.reduce(function(sum, storeId) {
		return sum + getRecordValue_(planRecords, storeId, metric, month) + getRecordValue_(vodRecords, storeId, metric, month);
	}, 0);
}

function getWorkforceStructurePlan_(storeIds, records, month) {
	return storeIds.reduce(function(sum, storeId) {
		return sum + calculateWorkforceStructurePlanForStore_(storeId, records, month);
	}, 0);
}

function calculateStructureHoursPlanForStores_(storeIds, records, month) {
	return storeIds.reduce(function(sum, storeId) {
		return sum + calculateStructureHoursPlanForStore_(storeId, records, month);
	}, 0);
}

function calculateStructureHoursActualForStores_(storeIds, records, month, presence) {
	return storeIds.reduce(function(sum, storeId) {
		return sum + calculateStructureHoursActualForStore_(storeId, records, month, presence);
	}, 0);
}

function calculateStructureHoursForecastForStores_(storeIds, planRecords, vodRecords, month, vodPresence) {
	return storeIds.reduce(function(sum, storeId) {
		return sum + calculateStructureHoursForecastForStore_(storeId, planRecords, vodRecords, month, vodPresence);
	}, 0);
}

function calculateWorkforceStructureForecastForStores_(storeIds, planRecords, vodRecords, month, vodPresence) {
	return storeIds.reduce(function(sum, storeId) {
		return sum + calculateWorkforceStructureForecastForStore_(storeId, planRecords, vodRecords, month, vodPresence);
	}, 0);
}

function calculateStructureHoursPlanForStore_(storeId, records, month) {
	const structureDays = getStructureDaysForStore_(storeId, records, month);
	const derivedHours = calculateWorkforceStructurePlanDailyHoursForStore_(storeId, records, month) * structureDays;

	if (derivedHours > 0) {
		return derivedHours;
	}

	return getRecordValue_(records, storeId, STRUCTURE_HOURS_METRIC, month);
}

function getExplicitStructureHoursValueForStore_(storeId, records, month, presence) {
	if (presence && hasMetricPresenceForStore_(storeId, presence, STRUCTURE_HOURS_METRIC, month)) {
		return getRecordValue_(records, storeId, STRUCTURE_HOURS_METRIC, month);
	}

	const directHours = Number(getRecordValue_(records, storeId, STRUCTURE_HOURS_METRIC, month) || 0);
	if (Math.abs(directHours) > 0.0001) {
		return directHours;
	}

	return null;
}

function calculateStructureHoursActualForStore_(storeId, records, month, presence) {
	const explicitHours = getExplicitStructureHoursValueForStore_(storeId, records, month, presence);
	if (explicitHours != null) {
		return explicitHours;
	}

	return calculateStructureHoursPlanForStore_(storeId, records, month);
}

function calculateStructureHoursForecastForStore_(storeId, planRecords, vodRecords, month, vodPresence) {
	const planHours = calculateStructureHoursPlanForStore_(storeId, planRecords, month);
	const structureDays = getStructureDaysForStore_(storeId, planRecords, month);
	const hasExplicitStructureAdjustment = hasExplicitStructureAdjustmentForStore_(storeId, vodRecords, month, vodPresence);
	if (!hasExplicitStructureAdjustment) {
		return planHours;
	}

	if (hasNonZeroWorkforceStructureMixForStore_(storeId, vodRecords, month, vodPresence)) {
		const derivedHours = calculateEffectiveWorkforceStructureDailyHoursForStore_(storeId, planRecords, vodRecords, month, vodPresence) * structureDays;
		if (derivedHours > 0) {
			return derivedHours;
		}
	}

	const structureHoursDelta = Number(getRecordValue_(vodRecords, storeId, STRUCTURE_HOURS_METRIC, month) || 0);
	if (Math.abs(structureHoursDelta) > 0.0001) {
		return planHours + structureHoursDelta;
	}

	const workforceDelta = Number(getRecordValue_(vodRecords, storeId, WORKFORCE_STRUCTURE_METRIC, month) || 0);
	if (Math.abs(workforceDelta) > 0.0001) {
		return calculateStructureHoursFromFte_(
			calculateWorkforceStructurePlanForStore_(storeId, planRecords, month) + workforceDelta,
			structureDays
		);
	}

	return planHours;
}

function calculateStructureHoursFromFte_(fteValue, workingDays) {
	return Number(fteValue || 0) * Number(workingDays || 0) * FULL_TIME_DAILY_HOURS;
}

function calculateGrossHoursForStores_(storeIds, records, month) {
	return storeIds.reduce(function(sum, storeId) {
		return sum + calculateGrossHoursForStore_(storeId, records, month);
	}, 0);
}

function calculateGrossHoursForecastForStores_(storeIds, planRecords, vodRecords, month, vodPresence) {
	return storeIds.reduce(function(sum, storeId) {
		return sum + calculateGrossHoursForecastForStore_(storeId, planRecords, vodRecords, month, vodPresence);
	}, 0);
}

function calculateGrossHoursForStore_(storeId, records, month) {
	return calculateGrossHoursFromGetter_(function(metric) {
		if (metric === STRUCTURE_HOURS_METRIC) {
			return calculateStructureHoursPlanForStore_(storeId, records, month);
		}

		return getRecordValue_(records, storeId, metric, month);
	});
}

function calculateGrossHoursActualForStore_(storeId, records, month, presence) {
	return calculateGrossHoursFromGetter_(function(metric) {
		if (metric === STRUCTURE_HOURS_METRIC) {
			return calculateStructureHoursActualForStore_(storeId, records, month, presence);
		}

		return getRecordValue_(records, storeId, metric, month);
	});
}

function calculateGrossHoursActualForStores_(storeIds, records, month, presence) {
	return storeIds.reduce(function(sum, storeId) {
		return sum + calculateGrossHoursActualForStore_(storeId, records, month, presence);
	}, 0);
}

function calculateGrossHoursForecastForStore_(storeId, planRecords, vodRecords, month, vodPresence) {
	return calculateGrossHoursFromGetter_(function(metric) {
		if (metric === STRUCTURE_HOURS_METRIC) {
			return calculateStructureHoursForecastForStore_(storeId, planRecords, vodRecords, month, vodPresence);
		}

		return getRecordValue_(planRecords, storeId, metric, month) + getRecordValue_(vodRecords, storeId, metric, month);
	});
}

function calculateGrossHoursFromGetter_(getter) {
	const structureHours = getter(STRUCTURE_HOURS_METRIC);
	const longAbsence = getter(LONG_ABSENCE_METRIC);
	return structureHours - longAbsence;
}

function getWorkingDaysForStore_(storeId, records, month) {
	const recordValue = getRecordValue_(records, storeId, WORKING_DAYS_METRIC, month);
	if (recordValue > 0) {
		return recordValue;
	}
	return getHardcodedMetricValue_(WORKING_DAYS_METRIC, month);
}

function getClosedHolidayDaysForStore_(storeId, records, month) {
	const recordValue = getRecordValue_(records, storeId, CLOSED_HOLIDAY_METRIC, month);
	if (recordValue > 0) {
		return recordValue;
	}
	return getHardcodedMetricValue_(CLOSED_HOLIDAY_METRIC, month);
}

function getStructureDaysForStore_(storeId, records, month) {
	return getWorkingDaysForStore_(storeId, records, month) + getClosedHolidayDaysForStore_(storeId, records, month);
}


function hasWorkforceStructureMixForStore_(storeId, records, month, presence) {
	return WORKFORCE_STRUCTURE_BANDS.some(function(band) {
		if (presence) {
			return hasMetricPresenceForStore_(storeId, presence, band.key, month);
		}
		return Math.abs(Number(getRecordValue_(records || {}, storeId, band.key, month) || 0)) > 0.0001;
	});
}

function hasNonZeroWorkforceStructureMixForStore_(storeId, records, month, presence) {
	return WORKFORCE_STRUCTURE_BANDS.some(function(band) {
		if (presence && !hasMetricPresenceForStore_(storeId, presence, band.key, month)) {
			return false;
		}
		return Math.abs(Number(getRecordValue_(records || {}, storeId, band.key, month) || 0)) > 0.0001;
	});
}

function hasExplicitStructureAdjustmentForStore_(storeId, records, month, presence) {
	if (hasNonZeroWorkforceStructureMixForStore_(storeId, records, month, presence)) {
		return true;
	}
	if (Math.abs(Number(getRecordValue_(records, storeId, WORKFORCE_STRUCTURE_METRIC, month) || 0)) > 0.0001) {
		return true;
	}
	if (Math.abs(Number(getRecordValue_(records, storeId, STRUCTURE_HOURS_METRIC, month) || 0)) > 0.0001) {
		return true;
	}
	return false;
}

function calculateWorkforceStructurePlanForStore_(storeId, records, month) {
	if (hasWorkforceStructureMixForStore_(storeId, records, month)) {
		return calculateWorkforceStructureFteForStore_(storeId, records, month);
	}

	const directFte = Number(getRecordValue_(records, storeId, WORKFORCE_STRUCTURE_METRIC, month) || 0);
	if (Math.abs(directFte) > 0.0001) {
		return directFte;
	}

	const structureDays = getStructureDaysForStore_(storeId, records, month);
	const directHours = Number(getRecordValue_(records, storeId, STRUCTURE_HOURS_METRIC, month) || 0);
	const denominator = structureDays * FULL_TIME_DAILY_HOURS;
	return denominator ? directHours / denominator : 0;
}

function calculateWorkforceStructurePlanDailyHoursForStore_(storeId, records, month) {
	if (hasWorkforceStructureMixForStore_(storeId, records, month)) {
		return calculateWorkforceStructureDailyHoursForStore_(storeId, records, month);
	}

	const directFte = Number(getRecordValue_(records, storeId, WORKFORCE_STRUCTURE_METRIC, month) || 0);
	if (Math.abs(directFte) > 0.0001) {
		return directFte * FULL_TIME_DAILY_HOURS;
	}

	const structureDays = getStructureDaysForStore_(storeId, records, month);
	const directHours = Number(getRecordValue_(records, storeId, STRUCTURE_HOURS_METRIC, month) || 0);
	return structureDays ? directHours / structureDays : 0;
}

function calculateWorkforceStructureDailyHoursForStore_(storeId, records, month) {
	return WORKFORCE_STRUCTURE_BANDS.reduce(function(sum, band) {
		return sum + (getRecordValue_(records, storeId, band.key, month) * band.hoursWeight);
	}, 0);
}

function calculateWorkforceStructureFteForStore_(storeId, records, month) {
	return WORKFORCE_STRUCTURE_BANDS.reduce(function(sum, band) {
		return sum + (getRecordValue_(records, storeId, band.key, month) * band.fteWeight);
	}, 0);
}

function getEffectiveWorkforceStructureBandValueForStore_(storeId, planRecords, vodRecords, month, band, vodPresence) {
	if (hasMetricPresenceForStore_(storeId, vodPresence || {}, band.key, month)) {
		return Number(getRecordValue_(vodRecords || {}, storeId, band.key, month) || 0);
	}
	return Number(getRecordValue_(planRecords || {}, storeId, band.key, month) || 0);
}

function calculateEffectiveWorkforceStructureDailyHoursForStore_(storeId, planRecords, vodRecords, month, vodPresence) {
	return WORKFORCE_STRUCTURE_BANDS.reduce(function(sum, band) {
		return sum + (getEffectiveWorkforceStructureBandValueForStore_(storeId, planRecords, vodRecords, month, band, vodPresence) * band.hoursWeight);
	}, 0);
}

function calculateEffectiveWorkforceStructureFteForStore_(storeId, planRecords, vodRecords, month, vodPresence) {
	return WORKFORCE_STRUCTURE_BANDS.reduce(function(sum, band) {
		return sum + (getEffectiveWorkforceStructureBandValueForStore_(storeId, planRecords, vodRecords, month, band, vodPresence) * band.fteWeight);
	}, 0);
}

function calculateWorkforceStructureForecastForStore_(storeId, planRecords, vodRecords, month, vodPresence) {
	if (hasExplicitStructureAdjustmentForStore_(storeId, vodRecords, month, vodPresence)) {
		if (hasNonZeroWorkforceStructureMixForStore_(storeId, vodRecords, month, vodPresence)) {
			return calculateEffectiveWorkforceStructureFteForStore_(storeId, planRecords, vodRecords, month, vodPresence);
		}

		return calculateWorkforceStructurePlanForStore_(storeId, planRecords, month)
			+ Number(getRecordValue_(vodRecords, storeId, WORKFORCE_STRUCTURE_METRIC, month) || 0);
	}

	return calculateWorkforceStructurePlanForStore_(storeId, planRecords, month);
}

function calculateWorkforceStructureAdjustment_(storeIds, records, month) {
	return storeIds.reduce(function(sum, storeId) {
		return sum + calculateWorkforceStructureDailyHoursForStore_(storeId, records, month);
	}, 0);
}

function buildEmptyWorkforceStructureMix_() {
	return {
		bands: [],
		totalAdjustment: 0,
		hasAnyData: false,
		isStructureMix: true,
	};
}

function getActualWorkforceStructureMixForStores_(storeIds, records, month, presence) {
	const bands = WORKFORCE_STRUCTURE_BANDS.map(function(band) {
		let count = 0;
		let hasData = false;

		storeIds.forEach(function(storeId) {
			const bandHasData = presence
				? hasMetricPresenceForStore_(storeId, presence, band.key, month)
				: Math.abs(Number(getRecordValue_(records || {}, storeId, band.key, month) || 0)) > 0.0001;
			if (!bandHasData) {
				return;
			}
			hasData = true;
			count += Number(getRecordValue_(records || {}, storeId, band.key, month) || 0);
		});

		return {
			key: band.key,
			label: band.label,
			fteWeight: band.fteWeight,
			hoursWeight: band.hoursWeight,
			count: Number(count || 0),
			hasData: hasData,
		};
	});

	const hasAnyData = bands.some(function(band) {
		return Boolean(band.hasData);
	});

	return {
		bands: bands,
		totalAdjustment: hasAnyData
			? roundMetric_(WORKFORCE_STRUCTURE_METRIC, bands.reduce(function(sum, band) {
				return sum + (band.count * band.fteWeight);
			}, 0))
			: 0,
		hasAnyData: hasAnyData,
		isStructureMix: true,
	};
}

function mergeWorkforceStructureMixReferences_(effectiveMix, planMix, realMix) {
	const planBandsByKey = (planMix && planMix.bands || []).reduce(function(result, band) {
		result[band.key] = band;
		return result;
	}, {});
	const realBandsByKey = (realMix && realMix.bands || []).reduce(function(result, band) {
		result[band.key] = band;
		return result;
	}, {});
	const effectiveBands = effectiveMix && effectiveMix.bands ? effectiveMix.bands : [];

	return {
		bands: effectiveBands.map(function(band) {
			const planBand = planBandsByKey[band.key] || {};
			const realBand = realBandsByKey[band.key] || {};
			return {
				key: band.key,
				label: band.label,
				fteWeight: band.fteWeight,
				hoursWeight: band.hoursWeight,
				count: Number(band.count || 0),
				planCount: Number(planBand.count || 0),
				realCount: Number(realBand.count || 0),
				hasRealCount: Boolean(realBand.hasData),
			};
		}),
		totalAdjustment: Number(effectiveMix && effectiveMix.totalAdjustment || 0),
		planTotalAdjustment: Number(planMix && planMix.totalAdjustment || 0),
		realTotalAdjustment: realMix && realMix.hasAnyData ? Number(realMix.totalAdjustment || 0) : null,
		hasRealMix: Boolean(realMix && realMix.hasAnyData),
		isStructureMix: true,
	};
}

function getWorkforceStructureMixForStores_(storeIds, records, month, fallbackRecords) {
	const bands = WORKFORCE_STRUCTURE_BANDS.map(function(band) {
		const count = storeIds.reduce(function(sum, storeId) {
			const primaryValue = getRecordValue_(records, storeId, band.key, month);
			if (primaryValue) {
				return sum + primaryValue;
			}
			return sum + getRecordValue_(fallbackRecords || {}, storeId, band.key, month);
		}, 0);
		return {
			key: band.key,
			label: band.label,
			fteWeight: band.fteWeight,
			hoursWeight: band.hoursWeight,
			count: Number(count || 0),
		};
	});

	return {
		bands: bands,
		totalAdjustment: roundMetric_(WORKFORCE_STRUCTURE_METRIC, bands.reduce(function(sum, band) {
			return sum + (band.count * band.fteWeight);
		}, 0)),
		isStructureMix: true,
	};
}

function getEffectiveWorkforceStructureMixForStores_(storeIds, planRecords, vodRecords, month, vodPresence) {
	const bands = WORKFORCE_STRUCTURE_BANDS.map(function(band) {
		const count = storeIds.reduce(function(sum, storeId) {
			if (hasExplicitStructureAdjustmentForStore_(storeId, vodRecords || {}, month, vodPresence || {})
				&& hasNonZeroWorkforceStructureMixForStore_(storeId, vodRecords || {}, month, vodPresence || {})) {
				return sum + getEffectiveWorkforceStructureBandValueForStore_(storeId, planRecords || {}, vodRecords || {}, month, band, vodPresence || {});
			}

			return sum + getRecordValue_(planRecords || {}, storeId, band.key, month);
		}, 0);

		return {
			key: band.key,
			label: band.label,
			fteWeight: band.fteWeight,
			hoursWeight: band.hoursWeight,
			count: Number(count || 0),
		};
	});

	return {
		bands: bands,
		totalAdjustment: roundMetric_(WORKFORCE_STRUCTURE_METRIC, bands.reduce(function(sum, band) {
			return sum + (band.count * band.fteWeight);
		}, 0)),
		isStructureMix: true,
	};
}

function isHiddenTableMetric_(metric) {
	return HIDDEN_TABLE_METRICS.indexOf(metric) > -1;
}

function sumValues_(values) {
	return values.reduce(function(sum, value) {
		return sum + Number(value || 0);
	}, 0);
}

function averageValues_(values) {
	if (!values.length) {
		return 0;
	}
	return sumValues_(values) / values.length;
}

function calculateNetHoursForStore_(storeId, records, month) {
	return calculateNetHoursFromGetter_(function(metric) {
		if (metric === STRUCTURE_HOURS_METRIC) {
			return calculateStructureHoursPlanForStore_(storeId, records, month);
		}

		return getRecordValue_(records, storeId, metric, month);
	});
}

function calculateNetHoursActualForStore_(storeId, records, month, presence) {
	return calculateNetHoursFromGetter_(function(metric) {
		if (metric === STRUCTURE_HOURS_METRIC) {
			return calculateStructureHoursActualForStore_(storeId, records, month, presence);
		}

		return getRecordValue_(records, storeId, metric, month);
	});
}

/**
 * Net hours formula:  floor(grossHours − (vacation + shortTermPn)
 *   + (agreement + agencyCleaning + agencyStocking + studentBonus/2 + overtime)
 *   + (saldoPlus + saldoMinus)) − holidayPay
 * Client-side mirror: computeNetHoursDelta() in dashboardSharedHelpers.html
 * @param {function(string):number} getter - Returns the value for a given metric key
 * @returns {number}
 */
function calculateNetHoursFromGetter_(getter) {
	const grossHours = calculateGrossHoursFromGetter_(getter);
	const vacation = getter(VACATION_METRIC);
	const shortTermPn = getter(SHORT_TERM_PN_METRIC);
	const agreement = getter(AGREEMENT_METRIC);
	const agencyCleaning = getter(AGENCY_CLEANING_METRIC);
	const agencyStocking = getter(AGENCY_STOCKING_METRIC);
	const studentBonus = getter(STUDENT_BONUS_METRIC) / 2;
	const overtime = getter(OVERTIME_METRIC);
	const saldoPlus = getter(SALDO_PLUS_METRIC);
	const saldoMinus = getter(SALDO_MINUS_METRIC);
	const holidayPay = getter(HOLIDAY_PAY_METRIC);
	const intermediate = grossHours - (vacation + shortTermPn)
		+ (agreement + agencyCleaning + agencyStocking + studentBonus + overtime)
		+ (saldoPlus + saldoMinus);

	return Math.floor(intermediate) - holidayPay;
}

function calculateNetHoursForecastForStore_(storeId, planRecords, vodRecords, month, vodPresence) {
	return calculateNetHoursFromGetter_(function(metric) {
		if (metric === STRUCTURE_HOURS_METRIC) {
			return calculateStructureHoursForecastForStore_(storeId, planRecords, vodRecords, month, vodPresence);
		}

		return getRecordValue_(planRecords, storeId, metric, month) + getRecordValue_(vodRecords, storeId, metric, month);
	});
}

function calculateDerivedForecastCleanPerformance_(storeIds, planRecords, realRecords, realPresence, vodRecords, month, closedMonth, vodPresence) {
	let turnover = 0;
	let hours = 0;

	storeIds.forEach(function(storeId) {
		const planTurnover = getRecordValue_(planRecords, storeId, OBRAT_METRIC, month);
		const realTurnover = getRecordValue_(realRecords, storeId, OBRAT_METRIC, month);
		const vodTurnover = getRecordValue_(vodRecords, storeId, OBRAT_METRIC, month);

		turnover += closedMonth ? realTurnover : planTurnover + vodTurnover;
		hours += closedMonth
			? getRealNetHoursForStore_(storeId, realRecords, month, realPresence)
			: calculateNetHoursForecastForStore_(storeId, planRecords, vodRecords, month, vodPresence);
	});

	return hours ? turnover / hours : 0;
}

function isClosedMonth_(monthLabel) {
	const monthDate = parseMonthLabel_(monthLabel);
	if (!monthDate) {
		return false;
	}
	const now = new Date();
	const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
	return monthDate.getTime() < currentMonthStart.getTime();
}

function parseMonthLabel_(monthLabel) {
	const parts = String(monthLabel || '').trim().split(/\s+/);
	if (parts.length < 2) {
		return null;
	}
	const monthName = normalizeMonthName_(parts[0]);
	const year = Number(parts[1]);
	if (MONTH_NAME_TO_INDEX[monthName] === undefined || !year) {
		return null;
	}
	return new Date(year, MONTH_NAME_TO_INDEX[monthName], 1);
}

function sortMonthsForBusinessYear_(months) {
	return months.slice().sort(function(left, right) {
		const leftDate = parseMonthLabel_(left);
		const rightDate = parseMonthLabel_(right);

		if (!leftDate && !rightDate) {
			return String(left).localeCompare(String(right));
		}
		if (!leftDate) {
			return 1;
		}
		if (!rightDate) {
			return -1;
		}

		const leftBusinessYear = getBusinessYear_(leftDate);
		const rightBusinessYear = getBusinessYear_(rightDate);
		if (leftBusinessYear !== rightBusinessYear) {
			return leftBusinessYear - rightBusinessYear;
		}

		return getBusinessMonthOrder_(leftDate) - getBusinessMonthOrder_(rightDate);
	});
}

function getBusinessYear_(dateValue) {
	const monthIndex = dateValue.getMonth();
	const year = dateValue.getFullYear();
	return monthIndex >= BUSINESS_YEAR_START_MONTH_INDEX ? year : year - 1;
}

function getBusinessMonthOrder_(dateValue) {
	return (dateValue.getMonth() - BUSINESS_YEAR_START_MONTH_INDEX + 12) % 12;
}

function normalizeMonthName_(value) {
	return String(value || '')
		.trim()
		.toLowerCase()
		.replace('á', 'a')
		.replace('é', 'e')
		.replace('í', 'i')
		.replace('ó', 'o')
		.replace('ú', 'u')
		.replace('ý', 'y');
}

function getMetricFormat_(metric) {
	if (metric === OBRAT_METRIC) {
		return 'currency';
	}
	if (metric === CLEAN_PERFORMANCE_METRIC) {
		return 'number';
	}
	if (metric === WORKING_DAYS_METRIC || metric === CLOSED_HOLIDAY_METRIC) {
		return 'number';
	}
	if (metric.indexOf('Štruktúra filiálky') > -1) {
		return 'fte';
	}
	return 'hours';
}

function getHardcodedMetricValue_(metric, monthLabel, monthIndex) {
	const normalizedMonth = normalizeText_(monthLabel);
	const resolvedIndex = Number(monthIndex) || 0;

	if (metric === WORKING_DAYS_METRIC) {
		if (Object.prototype.hasOwnProperty.call(HARDCODED_WORKING_DAYS_BY_MONTH, normalizedMonth)) {
			return HARDCODED_WORKING_DAYS_BY_MONTH[normalizedMonth];
		}
		return HARDCODED_WORKING_DAYS_FALLBACK[resolvedIndex] || 0;
	}

	if (metric === CLOSED_HOLIDAY_METRIC) {
		if (Object.prototype.hasOwnProperty.call(HARDCODED_CLOSED_HOLIDAYS_BY_MONTH, normalizedMonth)) {
			return HARDCODED_CLOSED_HOLIDAYS_BY_MONTH[normalizedMonth];
		}
		return HARDCODED_CLOSED_HOLIDAYS_FALLBACK[resolvedIndex] || 0;
	}

	return 0;
}

function roundMetric_(metric, value) {
	if (metric === OBRAT_METRIC) {
		return Math.round(value);
	}
	if (metric === CLEAN_PERFORMANCE_METRIC || metric === STRUCTURE_HOURS_METRIC || metric.indexOf('Štruktúra filiálky') > -1) {
		return Math.round(value * 10) / 10;
	}
	return Math.round(value);
}

function writeSummarySheet_(sheetName, headers, rows) {
	const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
	const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
	sheet.clearContents();
	sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
	if (rows.length) {
		sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
	}
	sheet.setFrozenRows(1);
	sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#d71920').setFontColor('#ffffff');
	sheet.autoResizeColumns(1, headers.length);
}

function getSummarySourceSheets_() {
	const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
	return {
		plan: spreadsheet.getSheetByName(SHEET_NAMES.PLAN) ? SHEET_NAMES.PLAN : '',
		real: spreadsheet.getSheetByName(SHEET_NAMES.REAL)
			? SHEET_NAMES.REAL
			: (spreadsheet.getSheetByName(LEGACY_REAL_SOURCE_SHEET_NAME) ? LEGACY_REAL_SOURCE_SHEET_NAME : ''),
		vod: spreadsheet.getSheetByName(SHEET_NAMES.VOD)
			? SHEET_NAMES.VOD
			: (spreadsheet.getSheetByName(LEGACY_VOD_SOURCE_SHEET_NAME) ? LEGACY_VOD_SOURCE_SHEET_NAME : ''),
	};
}

function notifySummaryBuildProgress_(message) {
	const text = String(message || '').trim();
	if (!text) {
		return;
	}

	Logger.log(text);
	const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
	if (spreadsheet && spreadsheet.toast) {
		spreadsheet.toast(text, 'Summary rebuild', 8);
	}
}

function sortMetrics_(metrics) {
	return metrics.slice().sort(function(left, right) {
		const leftIndex = UI_METRIC_ORDER.indexOf(left);
		const rightIndex = UI_METRIC_ORDER.indexOf(right);
		if (leftIndex === -1 && rightIndex === -1) {
			return left.localeCompare(right);
		}
		if (leftIndex === -1) {
			return 1;
		}
		if (rightIndex === -1) {
			return -1;
		}
		return leftIndex - rightIndex;
	});
}

function getShortTermPnRecordValue_(records, storeId, month) {
	const directKey = buildKey_(storeId, SHORT_TERM_PN_METRIC, month);
	const hasDirectRow = Object.prototype.hasOwnProperty.call(records || {}, directKey);
	const directValue = Number((records || {})[directKey] || 0);
	const hasSourceRows = SHORT_TERM_PN_SOURCE_METRICS.some(function(sourceMetric) {
		return Object.prototype.hasOwnProperty.call(records || {}, buildKey_(storeId, sourceMetric, month));
	});

	if (hasDirectRow || !hasSourceRows) {
		return directValue;
	}

	return SHORT_TERM_PN_SOURCE_METRICS.reduce(function(sum, sourceMetric) {
		return sum + Number((records || {})[buildKey_(storeId, sourceMetric, month)] || 0);
	}, 0);
}

function hasShortTermPnPresence_(presence, storeId, month) {
	const directKey = buildKey_(storeId, SHORT_TERM_PN_METRIC, month);
	if (Boolean((presence || {})[directKey])) {
		return true;
	}

	return SHORT_TERM_PN_SOURCE_METRICS.some(function(sourceMetric) {
		return Boolean((presence || {})[buildKey_(storeId, sourceMetric, month)]);
	});
}

function normalizeRecords_(records, metricOrder, months) {
	const normalized = {};
	Object.keys(records).forEach(function(key) {
		const parts = key.split('|');
		const canonicalMetric = canonicalizeMetric_(parts[1]);
		normalized[[parts[0], canonicalMetric, parts[2]].join('|')] = records[key];
	});
	return normalized;
}

function normalizePresence_(presence) {
	const normalized = {};
	Object.keys(presence).forEach(function(key) {
		const parts = key.split('|');
		const canonicalMetric = canonicalizeMetric_(parts[1]);
		normalized[[parts[0], canonicalMetric, parts[2]].join('|')] = Boolean(presence[key]);
	});
	return normalized;
}

function canonicalizeMetric_(metric) {
	const rawMetric = String(metric || '').trim();
	const normalizedMetric = normalizeText_(rawMetric);
	const canonicalKeys = Object.keys(METRIC_ALIASES);
	for (let index = 0; index < canonicalKeys.length; index += 1) {
		const canonical = canonicalKeys[index];
		const variants = METRIC_ALIASES[canonical];
		for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
			if (normalizeText_(variants[variantIndex]) === normalizedMetric) {
				return canonical;
			}
		}
	}
	return rawMetric;
}

function getMetricRow_(rows, metric, months) {
	const canonicalMetric = canonicalizeMetric_(metric);
	if (rows[canonicalMetric]) {
		return rows[canonicalMetric];
	}

	const fallback = {};
	months.forEach(function(month) {
		fallback[month] = {
			plan: 0,
			real: 0,
			adjustment: 0,
			forecast: 0,
			variance: 0,
			variancePct: 0,
			closedMonth: isClosedMonth_(month),
			hasRealData: false,
		};
	});
	return fallback;
}

/**
 * Reads a single numeric value from the flat records map.
 * @param {Object<string,number>} records - Keyed by storeId|metric|month
 * @param {string} storeId
 * @param {string} metric
 * @param {string} month
 * @returns {number}
 */
function getRecordValue_(records, storeId, metric, month) {
	const canonicalMetric = canonicalizeMetric_(metric);
	if (isShortTermPnMetric_(canonicalMetric)) {
		return getShortTermPnRecordValue_(records, storeId, month);
	}
	return coerceMetricNumericValue_((records || {})[buildKey_(storeId, canonicalMetric, month)]);
}

function coerceMetricNumericValue_(rawValue) {
	if (typeof rawValue === 'number') {
		return isNaN(rawValue) ? 0 : rawValue;
	}

	const parsed = parsePlanCsvNumber_(rawValue);
	return parsed.value;
}

function hasMetricPresenceForStores_(storeIds, presence, metric, month) {
	return storeIds.some(function(storeId) {
		return hasMetricPresenceForStore_(storeId, presence, metric, month);
	});
}

function hasNetHoursPresenceForStores_(storeIds, presence, month) {
	return NET_HOURS_COMPONENT_METRICS.some(function(metric) {
		return hasMetricPresenceForStores_(storeIds, presence, metric, month);
	});
}

function hasExplicitNetHoursPresenceForStores_(storeIds, presence, month) {
	return hasMetricPresenceForStores_(storeIds, presence, NET_HOURS_METRIC, month)
		|| hasMetricPresenceForStores_(storeIds, presence, NET_HOURS_PLAN_VT_METRIC, month);
}

function hasGrossHoursPresenceForStores_(storeIds, presence, month) {
	return hasMetricPresenceForStores_(storeIds, presence, STRUCTURE_HOURS_METRIC, month)
		|| hasMetricPresenceForStores_(storeIds, presence, LONG_ABSENCE_METRIC, month);
}

function hasOpenMonthRealActivityForStores_(storeIds, records, month) {
	return storeIds.some(function(storeId) {
		return hasOpenMonthRealActivityForStore_(storeId, records, month);
	});
}

function hasOpenMonthRealActivityForStore_(storeId, records, month) {
	const activityMetrics = [OBRAT_METRIC, NET_HOURS_METRIC, NET_HOURS_PLAN_VT_METRIC, STRUCTURE_HOURS_METRIC, WORKFORCE_STRUCTURE_METRIC]
		.concat(NET_HOURS_COMPONENT_METRICS)
		.concat(WORKFORCE_STRUCTURE_BANDS.map(function(band) { return band.key; }));
	for (let index = 0; index < activityMetrics.length; index += 1) {
		if (Math.abs(Number(getRecordValue_(records || {}, storeId, activityMetrics[index], month) || 0)) > 0.0001) {
			return true;
		}
	}

	return false;
}

function hasRealDataForMetric_(storeIds, presence, records, metric, month, closedMonth) {
	if (!closedMonth && !hasOpenMonthRealActivityForStores_(storeIds, records, month)) {
		return false;
	}

	if (metric === NET_HOURS_METRIC) {
		return hasExplicitNetHoursPresenceForStores_(storeIds, presence, month)
			|| hasNetHoursPresenceForStores_(storeIds, presence, month);
	}

	if (metric === CLEAN_PERFORMANCE_METRIC) {
		return hasMetricPresenceForStores_(storeIds, presence, OBRAT_METRIC, month)
			|| hasExplicitNetHoursPresenceForStores_(storeIds, presence, month)
			|| hasNetHoursPresenceForStores_(storeIds, presence, month);
	}

	if (isStructureDrivenMetric_(metric)) {
		return hasMetricPresenceForStores_(storeIds, presence, metric, month)
			|| hasMetricPresenceForStores_(storeIds, presence, STRUCTURE_HOURS_METRIC, month)
			|| hasMetricPresenceForStores_(storeIds, presence, WORKFORCE_STRUCTURE_METRIC, month)
			|| WORKFORCE_STRUCTURE_BANDS.some(function(band) {
				return hasMetricPresenceForStores_(storeIds, presence, band.key, month);
			});
	}

	return hasMetricPresenceForStores_(storeIds, presence, metric, month);
}

function hasMetricPresenceForStore_(storeId, presence, metric, month) {
	const canonicalMetric = canonicalizeMetric_(metric);
	if (isShortTermPnMetric_(canonicalMetric)) {
		return hasShortTermPnPresence_(presence, storeId, month);
	}
	return Boolean((presence || {})[buildKey_(storeId, canonicalMetric, month)]);
}

function buildKey_(storeId, metric, month) {
	return [storeId, metric, month].join('|');
}

function normalizeText_(value) {
	return String(value || '')
		.trim()
		.toLowerCase()
		.replace(/>/g, '+')
		.replace(/[áä]/g, 'a')
		.replace(/[č]/g, 'c')
		.replace(/[ď]/g, 'd')
		.replace(/[éě]/g, 'e')
		.replace(/[í]/g, 'i')
		.replace(/[ĺľ]/g, 'l')
		.replace(/[ň]/g, 'n')
		.replace(/[óô]/g, 'o')
		.replace(/[ŕř]/g, 'r')
		.replace(/[š]/g, 's')
		.replace(/[ť]/g, 't')
		.replace(/[úů]/g, 'u')
		.replace(/[ý]/g, 'y')
		.replace(/[ž]/g, 'z')
		.replace(/\+\s+/g, '+')
		.replace(/\s+/g, ' ');
}

function sanitizeStoreName_(storeId, storeName) {
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
		if (normalizeText_(parts[0]) !== normalizeText_(normalizedStoreId)) {
			break;
		}
		parts.shift();
		cleanedName = parts.join(' ').trim();
	}

	return cleanedName;
}

function buildStoreDisplayLabel_(storeId, storeName) {
	const normalizedStoreId = String(storeId || '').trim();
	const cleanedName = sanitizeStoreName_(normalizedStoreId, storeName);
	return [normalizedStoreId, cleanedName].filter(Boolean).join(' ');
}

function normalizeSheetMonthLabel_(value) {
	if (value == null || value === '') {
		return '';
	}

	if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
		return formatMonthYearLabel_(value);
	}

	const text = String(value || '').trim().replace(/\s+/g, ' ');
	if (!text) {
		return '';
	}

	const parsedMonth = parseMonthLabel_(text);
	if (parsedMonth) {
		return formatMonthYearLabel_(parsedMonth);
	}

	const parsedDate = new Date(text);
	if (!isNaN(parsedDate.getTime())) {
		return formatMonthYearLabel_(parsedDate);
	}

	return text;
}

function formatMonthYearLabel_(dateValue) {
	const monthNames = ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 'júl', 'august', 'september', 'október', 'november', 'december'];
	return monthNames[dateValue.getMonth()] + ' ' + dateValue.getFullYear();
}

function buildNoteScope_(user, scope) {
	if (scope.type === 'STORE') {
		return {
			key: 'STORE|' + scope.id,
			type: 'STORE',
			scopeId: scope.id,
			label: scope.label,
		};
	}

	if (user.role === 'GF') {
		return {
			key: 'AGGREGATE|GF|' + user.gfName,
			type: 'AGGREGATE',
			scopeId: user.gfName,
			label: scope.label,
		};
	}

	return {
		key: 'AGGREGATE|VKL|' + user.vklName,
		type: 'AGGREGATE',
		scopeId: user.vklName,
		label: scope.label,
	};
}

function getMetricNotesForScopeMetric_(noteScope, metric) {
	const sheet = ensureNotesSheet_();
	const values = sheet.getDataRange().getValues();
	const canonicalMetric = normalizeNoteMetricKey_(metric);
	const notes = emptyMetricNotes_();

	for (let row = 1; row < values.length; row += 1) {
		const scopeKey = String(values[row][0] || '').trim();
		const rowMetric = normalizeNoteMetricKey_(values[row][4]);
		const role = String(values[row][5] || '').trim().toUpperCase();
		if (scopeKey !== noteScope.key || rowMetric !== canonicalMetric || ['VOD', 'VKL'].indexOf(role) === -1) {
			continue;
		}

		notes[role] = {
			text: String(values[row][7] || ''),
			author: String(values[row][6] || '').trim(),
			updatedAt: String(values[row][8] || '').trim(),
		};
	}

	return notes;
}

function normalizeNoteMetricKey_(metric) {
	const rawMetric = String(metric == null ? '' : metric).trim();
	if (!rawMetric) {
		return '';
	}
	if (rawMetric === GLOBAL_SCOPE_NOTE_METRIC) {
		return GLOBAL_SCOPE_NOTE_METRIC;
	}
	return canonicalizeMetric_(rawMetric);
}

function emptyMetricNotes_() {
	return {
		VOD: { text: '', author: '', updatedAt: '' },
		VKL: { text: '', author: '', updatedAt: '' },
	};
}

function ensureNotesSheet_() {
	const headers = ['Scope Key', 'Scope Type', 'Scope Id', 'Scope Label', 'Metrika', 'Rola', 'Autor', 'Poznamka', 'Updated At'];
	const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
	const sheet = spreadsheet.getSheetByName(SHEET_NAMES.NOTES) || spreadsheet.insertSheet(SHEET_NAMES.NOTES);
	const needsHeader = sheet.getLastRow() === 0 || String(sheet.getRange(1, 1).getValue()).trim() !== headers[0];

	if (needsHeader) {
		sheet.clearContents();
		sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
		sheet.setFrozenRows(1);
		sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#d71920').setFontColor('#ffffff');
		sheet.autoResizeColumns(1, headers.length);
	}

	return sheet;
}

function ensureWeeklyVodOverridesSheet_() {
	const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
	const sheet = spreadsheet.getSheetByName(SHEET_NAMES.WEEKLY_VOD_OVERRIDES) || spreadsheet.insertSheet(SHEET_NAMES.WEEKLY_VOD_OVERRIDES);
	const needsHeader = sheet.getLastRow() === 0 || String(sheet.getRange(1, 1).getValue()).trim() !== WEEKLY_VOD_OVERRIDE_HEADERS[0];

	if (needsHeader) {
		sheet.clearContents();
		sheet.getRange(1, 1, 1, WEEKLY_VOD_OVERRIDE_HEADERS.length).setValues([WEEKLY_VOD_OVERRIDE_HEADERS]);
		sheet.setFrozenRows(1);
		sheet.getRange(1, 1, 1, WEEKLY_VOD_OVERRIDE_HEADERS.length).setFontWeight('bold').setBackground('#d71920').setFontColor('#ffffff');
		sheet.autoResizeColumns(1, WEEKLY_VOD_OVERRIDE_HEADERS.length);
	}

	return sheet;
}

function getRequiredSheet_(sheetName) {
	const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
	if (!sheet) {
		throw new Error('Sheet ' + sheetName + ' neexistuje.');
	}
	return sheet;
}

function getSheetWithLegacyFallback_(sheetName, legacySheetName) {
	const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
	const currentSheet = spreadsheet.getSheetByName(sheetName);
	if (currentSheet) {
		return currentSheet;
	}
	if (legacySheetName) {
		const legacySheet = spreadsheet.getSheetByName(legacySheetName);
		if (legacySheet) {
			return legacySheet;
		}
	}
	return getRequiredSheet_(sheetName);
}
