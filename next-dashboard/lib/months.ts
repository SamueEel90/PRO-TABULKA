const BUSINESS_YEAR_START_MONTH_INDEX = 2;

const MONTH_NAMES_SK = [
  'január',
  'február',
  'marec',
  'apríl',
  'máj',
  'jún',
  'júl',
  'august',
  'september',
  'október',
  'november',
  'december',
];

const MONTH_ALIASES: Record<string, number> = {
  januar: 0,
  'január': 0,
  februar: 1,
  'február': 1,
  marec: 2,
  april: 3,
  'apríl': 3,
  maj: 4,
  'máj': 4,
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

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
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
    .replace(/\s+/g, ' ');
}

export type ResolvedMonth = {
  id: string;
  label: string;
  year: number;
  monthNumber: number;
  businessYear: number;
  businessOrder: number;
};

export function resolveMonthLabel(input: string): ResolvedMonth {
  const parts = input.trim().split(/\s+/);
  if (parts.length < 2) {
    throw new Error(`Neplatný formát mesiaca: ${input}`);
  }

  const year = Number(parts.at(-1));
  const monthName = normalizeText(parts.slice(0, -1).join(' '));
  const monthIndex = MONTH_ALIASES[monthName];

  if (Number.isNaN(year) || monthIndex == null) {
    throw new Error(`Neznámy mesiac: ${input}`);
  }

  const monthNumber = monthIndex + 1;
  const id = `${year}-${String(monthNumber).padStart(2, '0')}`;
  const businessYear = monthIndex >= BUSINESS_YEAR_START_MONTH_INDEX ? year : year - 1;
  const businessOrder = (monthIndex - BUSINESS_YEAR_START_MONTH_INDEX + 12) % 12;

  return {
    id,
    label: `${MONTH_NAMES_SK[monthIndex]} ${year}`,
    year,
    monthNumber,
    businessYear,
    businessOrder,
  };
}
