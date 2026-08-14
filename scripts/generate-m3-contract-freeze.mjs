import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const defaultOutput = path.join(root, 'artifacts', 'verification', 'M3-000', 'm3-contract-freeze.json');
const outputArg = process.argv.indexOf('--output');
const output = outputArg >= 0 ? path.resolve(process.argv[outputArg + 1]) : defaultOutput;

const parseLine = (line) => {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted && character === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { values.push(value); value = ''; }
    else value += character;
  }
  if (quoted) throw new Error('CSV_UNTERMINATED_QUOTE');
  values.push(value);
  return values;
};
const readCsv = async (name) => {
  const lines = (await readFile(path.join(pack, name), 'utf8')).split(/\r?\n/u).filter(Boolean);
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, parseLine(line)[index] ?? ''])));
};
const list = (value) => value.split(',').filter(Boolean);

const p0Ids = '020 022 023 024 025 026 027 028 029 030 031 051 052 053 054 055 056 057 058 059 062 073 074 075 076 077 078 079 080 081 083 084 085 086 087 088 089 090 091 092 093 094 096 097 098'.split(' ').map((id) => `P0-${id}`);
const entityP0 = {
  ConsumerUser: ['P0-083', 'P0-085', 'P0-097', 'P0-098'],
  ConsumerWechatIdentity: ['P0-083', 'P0-085', 'P0-098'], ConsumerSession: ['P0-085', 'P0-098'],
  ConsumerAddress: ['P0-091', 'P0-097', 'P0-098'], ConsumerInvoiceProfile: ['P0-091', 'P0-097', 'P0-098'],
  ShoppingCart: ['P0-090'], ShoppingCartItem: ['P0-090'], ConsumerMessage: ['P0-093', 'P0-094', 'P0-097'],
  EnterpriseCustomer: ['P0-028', 'P0-077'], EnterpriseUser: ['P0-028', 'P0-080'],
  EnterpriseAddress: ['P0-029', 'P0-079'], EnterpriseInvoiceProfile: ['P0-029', 'P0-079'],
  EnterpriseProcurementProfile: ['P0-029', 'P0-078'], EnterpriseProcurementOrder: ['P0-022', 'P0-029', 'P0-062', 'P0-079', 'P0-080'],
  EnterpriseWelfarePurchase: ['P0-051', 'P0-059'], WelfareCardProgram: ['P0-051', 'P0-054'],
  WelfareCardBatch: ['P0-051'], WelfareCardCode: ['P0-052', 'P0-059'], WelfareCardAccount: ['P0-052', 'P0-053', 'P0-059', 'P0-092', 'P0-097'],
  WelfareCardLedger: ['P0-055', 'P0-056', 'P0-057', 'P0-058', 'P0-059'],
  Order: ['P0-022', 'P0-023', 'P0-024', 'P0-025', 'P0-026', 'P0-062', 'P0-091', 'P0-093', 'P0-094'],
  OrderItem: ['P0-022', 'P0-023', 'P0-026', 'P0-062'], OrderPaymentAllocation: ['P0-024', 'P0-026', 'P0-055', 'P0-056', 'P0-058'],
  PaymentTransaction: ['P0-024', 'P0-056', 'P0-057', 'P0-093'], RefundTransaction: ['P0-026', 'P0-058', 'P0-096'],
  SupplierFulfillmentSubOrder: ['P0-031', 'P0-062'],
};

const enumFormats = {
  'ConsumerUser.status': 'ACTIVE|RESTRICTED|CLOSED', 'ConsumerWechatIdentity.status': 'ACTIVE|REVOKED',
  'ConsumerInvoiceProfile.profileType': 'PERSONAL|ENTERPRISE', 'ConsumerMessage.messageType': 'SYSTEM|ORDER|PAYMENT|REFUND|WELFARE_CARD|FULFILLMENT',
  'ConsumerMessage.businessType': 'ORDER|PAYMENT|REFUND|WELFARE_CARD|FULFILLMENT',
  'EnterpriseCustomer.agreementStatus': 'NOT_SIGNED|ACTIVE|EXPIRED|TERMINATED', 'EnterpriseCustomer.status': 'DRAFT|PENDING_REVIEW|CORRECTION_REQUIRED|ACTIVE|SUSPENDED|REJECTED',
  'EnterpriseUser.role': 'ENTERPRISE_ADMIN|ENTERPRISE_PURCHASER', 'EnterpriseUser.status': 'INVITED|ACTIVE|SUSPENDED|DISABLED',
  'EnterpriseWelfarePurchase.paymentStatus': 'PENDING|WECHAT_PAID|BANK_TRANSFER_PENDING|CONFIRMED|REFUNDED', 'EnterpriseWelfarePurchase.status': 'DRAFT|SUBMITTED|ACTIVE|COMPLETED|CANCELLED',
  'WelfareCardProgram.fundingType': 'ENTERPRISE_GRANT|COMPANY_GIFT|PHYSICAL_CARD_OR_CODE', 'WelfareCardProgram.scopeType': 'ALL_PRODUCTS|CATEGORY|PRODUCT|SKU',
  'WelfareCardProgram.complianceStatus': 'DRAFT|PENDING_REVIEW|APPROVED|REJECTED', 'WelfareCardProgram.status': 'DRAFT|ACTIVE|SUSPENDED|EXPIRED|CLOSED',
  'WelfareCardBatch.claimMode': 'ENTERPRISE_ASSIGNED|PHYSICAL_CARD_OR_CODE', 'WelfareCardBatch.status': 'DRAFT|ISSUED|SUSPENDED|EXPIRED|CLOSED',
  'WelfareCardCode.status': 'UNCLAIMED|CLAIMED|DISABLED|EXPIRED', 'WelfareCardAccount.status': 'UNCLAIMED|ACTIVE|SUSPENDED|EXPIRED|CLOSED',
  'WelfareCardLedger.businessType': 'CLAIM|GRANT|GIFT|FREEZE|RELEASE|CAPTURE|REFUND|REVERSAL|ADJUSTMENT', 'WelfareCardLedger.direction': 'CREDIT|DEBIT',
  'Order.orderType': 'CONSUMER|ENTERPRISE', 'Order.externalPaymentMethod': 'WECHAT_PAY',
  'Order.paymentStatus': 'NOT_REQUIRED|PENDING|PAID|FAILED|CLOSED|UNKNOWN', 'Order.orderStatus': 'DRAFT|PENDING_PAYMENT|PAID|FULFILLING|PARTIALLY_DELIVERED|COMPLETED|CANCELLED',
  'OrderItem.refundStatus': 'NONE|REQUESTED|PROCESSING|PARTIAL|REFUNDED|REJECTED', 'PaymentTransaction.status': 'CREATED|PREPAY_CREATED|PAID|CLOSED|UNKNOWN|FAILED',
  'RefundTransaction.status': 'CREATED|PROCESSING|PARTIAL_CHANNEL_DONE|SUCCEEDED|UNKNOWN|FAILED', 'EnterpriseProcurementProfile.status': 'DRAFT|ACTIVE|SUSPENDED',
  'EnterpriseProcurementOrder.paymentMethod': 'WECHAT_PAY|BANK_TRANSFER', 'EnterpriseProcurementOrder.remittanceReviewStatus': 'NOT_SUBMITTED|PENDING_REVIEW|CONFIRMED|REJECTED',
  'EnterpriseProcurementOrder.status': 'DRAFT|PENDING_PAYMENT|PAYMENT_CONFIRMING|PAID|FULFILLING|COMPLETED|CANCELLED',
  'EnterpriseRemittanceSubmission.status': 'PENDING_REVIEW|CONFIRMED|REJECTED', 'EnterpriseRemittanceReview.decision': 'CONFIRM|REJECT',
  'SupplierFulfillmentSubOrder.channelType': 'CONSUMER|ENTERPRISE', 'SupplierFulfillmentSubOrder.preparationStatus': 'PENDING|ACCEPTED|PREPARING|READY_FOR_HANDOVER|HANDED_OVER|COMPLETED|CANCELLED',
  'SupplierFulfillmentSubOrder.handoverStatus': 'NOT_READY|READY|HANDED_OVER', 'SupplierFulfillmentSubOrder.settlementStatus': 'NOT_RECONCILED|PENDING_STATEMENT|IN_STATEMENT|ADJUSTED',
};
const enumType = (key) => `Enum<${key.replace('.', '')}>`;
const resolveType = (row) => {
  const key = `${row.Entity}.${row.Field}`;
  if (enumFormats[key]) return enumType(key);
  if (row.Field === 'lat' || row.Field === 'lng') return 'Decimal(10,7)';
  if (key === 'WelfareCardProgram.canPayDeliveryFee') return 'Boolean';
  if (row.SuggestedType === 'String/UUID') return 'String(36)';
  if (row.SuggestedType === 'String') return 'String(191)';
  if (row.SuggestedType === 'Int(分)') return 'Int';
  if (/^String\(\d+\)$/u.test(row.SuggestedType)) return row.SuggestedType;
  if (/^Enum<[^>]+>$/u.test(row.SuggestedType)) return row.SuggestedType;
  if (/^Decimal\(\d+,\d+\)$/u.test(row.SuggestedType)) return row.SuggestedType;
  if (/^DateTime\(\d+\)\??$/u.test(row.SuggestedType)) return row.SuggestedType;
  if (['Boolean', 'DateTime', 'Int', 'Json', 'Decimal'].includes(row.SuggestedType)) return row.SuggestedType;
  throw new Error(`M3_FIELD_TYPE_UNRESOLVED:${key}:${row.SuggestedType}`);
};
const resolveFormat = (row, type) => {
  const key = `${row.Entity}.${row.Field}`;
  if (enumFormats[key]) return enumFormats[key];
  if (type === 'String(36)') return `${row.Required === 'NO' ? 'nullable; ' : ''}UUID v4`;
  if (type.startsWith('String(')) return `UTF-8; max ${type.slice(7, -1)} chars`;
  if (type === 'Decimal(10,7)') return row.Field === 'lat' ? '-90..90; 7 decimal places' : '-180..180; 7 decimal places';
  if (type === 'DateTime' || /^DateTime\(\d+\)\??$/u.test(type)) return `${row.Required === 'NO' ? 'nullable; ' : ''}UTC ISO-8601`;
  if (type === 'Boolean') return 'true|false';
  if (type === 'Json') return 'canonical schema-versioned JSON';
  if (type === 'Int' && /amount|price|balance|fee|value/i.test(row.Field)) return 'integer cents; >=0';
  if (type === 'Int') return 'integer';
  if (type === 'Decimal') return 'fixed-point decimal';
  throw new Error(`M3_FIELD_FORMAT_UNRESOLVED:${key}`);
};
const resolveValidation = (row) => {
  if (['companyId', 'supplierId', 'consumerUserId', 'enterpriseCustomerId'].includes(row.Field)) return 'derived from verified server session or owned aggregate; client owner input rejected';
  if (/amount|price|balance|fee|value/i.test(row.Field)) return 'integer cents; arithmetic and cumulative limits checked transactionally';
  if (row.Field === 'fundingType') return 'exact allowlist of three non-personal-recharge funding sources';
  if (row.Field === 'externalPaymentMethod') return 'consumer online cash method must be WECHAT_PAY';
  if (/status/i.test(row.Field)) return 'legal state transition, optimistic version and audit required';
  if (/snapshot/i.test(row.Field)) return 'immutable schema-versioned snapshot; never overwritten';
  if (/Encrypted|Hash/i.test(row.Field)) return 'encrypted or one-way hashed; masked DTO; never logged in plaintext';
  if (row.Field === 'id' || /Id$/u.test(row.Field)) return 'server-owned identifier; owner scope checked before not-found disclosure';
  return 'DTO whitelist; required/type/range/ownership validation';
};

const [fields, states, permissions, pages, apis, migrations] = await Promise.all([
  readCsv('05-字段字典初始版.csv'), readCsv('06-状态机总表.csv'), readCsv('07-权限与数据可见矩阵.csv'),
  readCsv('08-页面路由接口P0映射.csv'), readCsv('12-OpenAPI-DTO-错误码台账.csv'), readCsv('11-数据库迁移台账.csv'),
]);
const m3Fields = fields.filter(({ Stage }) => Stage === 'M3').map((row) => {
  const type = resolveType(row);
  const mappedP0 = row.P0 && row.P0 !== '待切片细化' ? list(row.P0) : entityP0[row.Entity];
  if (!mappedP0?.length) throw new Error(`M3_FIELD_P0_MISSING:${row.Entity}.${row.Field}`);
  return { entity: row.Entity, name: row.Field, type, required: row.Required === 'YES', format: resolveFormat(row, type), sensitivity: row.Sensitivity, visibility: row.Visibility, forbiddenExposure: row.ForbiddenExposure, validation: resolveValidation(row), historyRule: row.HistoryRule, p0Ids: mappedP0 };
});
if (m3Fields.length !== 255) throw new Error(`M3_FIELD_COUNT:${m3Fields.length}`);
const groupedFields = [...new Set(m3Fields.map(({ entity }) => entity))].map((entity) => ({
  entity,
  fields: m3Fields
    .filter((row) => row.entity === entity)
    .map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'entity'))),
}));

const specialCategories = new Map([
  ['P0-059', 'PERSONAL_RECHARGE'], ['P0-056', 'NON_WECHAT_CONSUMER_CASH'], ['P0-024', 'DUPLICATE_CALLBACK'],
  ['P0-057', 'OUT_OF_ORDER_CALLBACK'], ['P0-026', 'REFUND_OVERPAID'], ['P0-022', 'CROSS_OWNER_ACCESS'],
  ['P0-020', 'SUPPLY_PRICE_LEAK'], ['P0-098', 'DIRECT_WX_REQUEST'], ['P0-081', 'PRIVATE_PUBLIC_CACHE'], ['P0-031', 'M3_DELIVERY_CREATION'],
]);
const negativeTests = p0Ids.flatMap((p0Id) => {
  const taskId = `M3-P${p0Id.slice(3)}`;
  const categories = [specialCategories.get(p0Id) ?? 'INVALID_INPUT', 'UNAUTHORIZED_OR_WRONG_OWNER', 'DUPLICATE_OR_STATE_CONFLICT'];
  return categories.map((category, index) => ({ id: `NEG-${taskId}-${String(index + 1).padStart(2, '0')}`, taskId, p0Id, category, expected: 'reject with stable error; no state, money, inventory, ledger, cache or audit invariant corruption', executionStatus: 'NOT_EXECUTED' }));
});
const slices = p0Ids.map((p0Id) => ({ taskId: `M3-P${p0Id.slice(3)}`, p0Id, contractRefs: { fields: m3Fields.filter((field) => field.p0Ids.includes(p0Id)).map((field) => `${field.entity}.${field.name}`), pages: pages.filter((row) => row.Stage === 'M3' && list(row.P0).includes(p0Id)).map((row) => row.PageID), apis: apis.filter((row) => row.Stage === 'M3' && list(row.P0).includes(p0Id)).map((row) => row.ContractID) }, negativeTestIds: negativeTests.filter((row) => row.p0Id === p0Id).map((row) => row.id) }));

const freeze = {
  schemaVersion: '1.0.0', taskId: 'M3-000', stage: 'M3', status: 'CONTRACT_FROZEN', implementationStatus: 'NOT_IMPLEMENTED', frozenAt: '2026-08-13T06:00:00-04:00',
  baseline: { schemeSha256: '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92', m2GateMergeCommit: '6cbe9460109c3b0ed5eb4ba307eec4c2cb5d23d9', m2GateMainCiRun: '31686758134' },
  scope: { p0Ids, businessTaskIds: p0Ids.map((id) => `M3-P${id.slice(3)}`), businessSliceStarted: false, nextAllowedAfterMergeAndGreenCi: 'M3-P020', forbiddenRuntimeDomains: ['M4_DELIVERY', 'M5_SETTLEMENT', 'PRODUCTION_EXTERNALS'] },
  fieldContract: { count: m3Fields.length, entities: groupedFields },
  stateContract: { transitions: states.filter(({ Stage }) => Stage === 'M3').map((row) => ({ stateMachine: row.StateMachine, currentState: row.CurrentState, event: row.Event, nextState: row.NextState, allowedActor: row.AllowedActor, guard: row.Guard, sideEffect: row.SideEffect, idempotency: row.Idempotency, p0Ids: list(row.P0) })), illegalTransition: { status: 409, errorCode: 'STATE_TRANSITION_INVALID', stateChanged: false }, concurrency: 'OPTIMISTIC_VERSION_UNIQUE_KEY_TRANSACTION' },
  permissionContract: { defaultDecision: 'DENY', sessionActiveFunctionalAccountLimit: 1, roles: permissions.filter(({ Stage }) => Stage === 'M3').map((row) => ({ roleCode: row.RoleCode, ownerType: row.OwnerType, entryRoute: row.EntryRoute, dataScope: row.DataScope, supplyPriceVisibility: row.SupplyPriceVisibility, forbiddenActions: row.ForbiddenActions, p0Ids: list(row.P0) })) },
  pageContract: { pages: pages.filter(({ Stage }) => Stage === 'M3').map((row) => ({ pageId: row.PageID, route: row.Route, p0Ids: list(row.P0), implementationStatus: 'NOT_IMPLEMENTED' })) },
  apiContract: { contracts: apis.filter(({ Stage }) => Stage === 'M3').map((row) => ({ contractId: row.ContractID, method: row.Method, path: row.Path, requestDto: row.RequestDTO, responseDto: row.ResponseDTO, errorCodes: row.ErrorCodes, p0Ids: list(row.P0), implementationStatus: 'NOT_IMPLEMENTED' })) },
  migrationContract: migrations.filter(({ Stage }) => Stage === 'M3').map((row) => ({ migrationId: row.MigrationID, purpose: row.Purpose, rollbackStrategy: row.RollbackStrategy, status: 'PLANNED_NOT_CREATED' })),
  welfareCard: { fundingSources: ['ENTERPRISE_GRANT', 'COMPANY_GIFT', 'PHYSICAL_CARD_OR_CODE'], personalRecharge: { permanentlyForbidden: true, apiExists: false, routeExists: false, featureFlagExists: false, placeholderExists: false }, ledger: 'APPEND_ONLY' },
  payment: { personalOnlineCashMethods: ['WECHAT_PAY'], enterpriseMethods: ['WECHAT_PAY', 'BANK_TRANSFER'], bankTransferExposedToConsumer: false, amountUnit: 'INTEGER_CENTS', allocationInvariant: 'ORDER_TOTAL = WELFARE_CARD + WECHAT_PAY', callback: 'SIGNATURE_AMOUNT_STATE_IDEMPOTENCY_REQUIRED', unknownResult: 'QUERY_BEFORE_RETRY' },
  refund: { structure: 'ORIGINAL_PAYMENT_ALLOCATION', cumulativeRefundMayExceedPaid: false, appendOrReversalOnly: true },
  order: { customerCounterparty: 'JIANGSU_FULITUAN_SUPPLY_CHAIN_TECHNOLOGY_CO_LTD', crossSupplierSingleBuyerOrder: true, supplierFulfillmentSplit: true, immutableSnapshots: true },
  inventory: { crossSupplierReservation: 'ATOMIC_ALL_OR_NOTHING', operations: ['RESERVE', 'CONFIRM', 'RELEASE'], businessKeyIdempotency: true },
  deliveryBoundary: { createsDeliveryTask: false, createsEnterpriseDeliveryOrder: false, publishesOutboxContractOnly: true },
  dto: { databaseEntityReturnedDirectly: false, supplyPriceInBuyerResponses: false, ownerFieldsDerivedFromSession: true },
  miniapp: { transport: 'miniapp-kit', nativeAdapter: 'wx.request', directWxRequestOutsideAdapterAllowed: false, reusesGeneratedOpenApiTypes: true },
  portal: { publicContentRendering: 'SSG_OR_ISR', privateZones: ['AUTHENTICATED', 'PREVIEW', 'TRANSACTION'], privateResponseHeaders: ['Cache-Control: private, no-store', 'X-Robots-Tag: noindex'] },
  errors: ['STATE_TRANSITION_INVALID', 'OWNER_SCOPE_FORBIDDEN', 'PERSONAL_RECHARGE_FORBIDDEN', 'CONSUMER_PAYMENT_METHOD_NOT_ALLOWED', 'PAYMENT_CALLBACK_INVALID', 'PAYMENT_RESULT_UNKNOWN', 'REFUND_EXCEEDS_PAID', 'INVENTORY_RESERVATION_FAILED', 'IDEMPOTENCY_CONFLICT'],
  negativeTests, slices,
};

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(freeze, null, 2)}\n`, 'utf8');
