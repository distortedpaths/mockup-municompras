/* Municipalidad de Santiago / compras — prototipo funcional en memoria */

/* ===== Valores configurables ===== */
// Logo: para usar la imagen oficial cambia solo esta ruta. Si queda vacía se muestra el texto "Municipalidad de Santiago".
const LOGO_SRC = 'logo.svg';
const MUNICIPALITY_NAME = 'Municipalidad de Santiago';

// Tramos de visado. Cada tramo cubre hasta maxAmount (inclusive); el monto se asigna al primer tramo que lo cubre.
// Un rol puede visar su tramo y todos los inferiores. Para cambiar montos o aprobadores basta editar esta constante.
const ROLE_SUPER = 'Superusuario de visado';
const APPROVAL_TIERS = [
  { id: 'supervisor', maxAmount: 10000000, approverRole: 'Supervisor', approverLabel: 'Supervisor habilitado', blockMessage: 'Esta compra requiere visado del Supervisor' },
  { id: 'jefatura', maxAmount: 20000000, approverRole: 'Jefatura', approverLabel: 'Jefatura', blockMessage: 'Esta compra requiere visado de Jefatura' },
  { id: 'superusuario', maxAmount: Infinity, approverRole: ROLE_SUPER, approverLabel: 'Superusuario de visado', blockMessage: 'Esta compra requiere visado del Superusuario' },
];

// Perfiles de ejemplo disponibles en el login y en el selector de rol.
const ROLE_PROFILES = {
  Solicitante: { id: 'USR-001', name: 'Carlos Pérez', department: 'Finanzas', icon: 'user-round', summary: 'Crea solicitudes y sigue su avance.' },
  Comprador: { id: 'USR-003', name: 'Ana Silva', department: 'Abastecimiento', icon: 'shopping-cart', summary: 'Cotiza, evalúa, adjudica y cierra contratos.' },
  Supervisor: { id: 'USR-007', name: 'Roberto Mena', department: 'Abastecimiento', icon: 'user-check', summary: '' },
  Jefatura: { id: 'USR-002', name: 'María González', department: 'Administración', icon: 'clipboard-check', summary: '' },
  [ROLE_SUPER]: { id: 'USR-008', name: 'Patricio Contreras', department: 'Administración Municipal', icon: 'crown', summary: '' },
  'Administrador técnico': { id: 'USR-005', name: 'Javiera León', department: 'Tecnología', icon: 'user-cog', summary: 'Administra usuarios y parámetros del sistema.' },
  Pasante: { id: 'USR-006', name: 'Martín Pérez', department: 'Administración', icon: 'eye', summary: 'Solo consulta y carga de documentos.' },
};
// Rol de solo lectura: ve solicitudes y sube documentos, pero no crea, cotiza, visa ni cierra.
const READ_ONLY_ROLE = 'Pasante';
const READ_ONLY_MESSAGE = 'Tu rol (Pasante) solo permite consulta y carga de documentos';
const ROLES = Object.keys(ROLE_PROFILES);
const VISADO_ROLES = [...APPROVAL_TIERS.map((tier) => tier.approverRole)];

// Qué rol entra a cada sección y qué acciones puede ejecutar.
const ROUTE_ACCESS = {
  dashboard: ROLES,
  solicitudes: ROLES,
  solicitud: ROLES,
  'mis-compras': ['Comprador'],
  cotizaciones: ['Comprador', ...VISADO_ROLES],
  aprobaciones: VISADO_ROLES,
  contratos: ['Comprador', ...VISADO_ROLES, 'Administrador técnico'],
  'presupuesto': ['Comprador', ...VISADO_ROLES],
  'renovacion-equipos': ['Comprador', ...VISADO_ROLES, 'Administrador técnico', READ_ONLY_ROLE],
  'fondos-insuficientes': ['Comprador', ...VISADO_ROLES],
  proveedores: ['Comprador', ...VISADO_ROLES, 'Administrador técnico'],
  proveedor: ['Comprador', ...VISADO_ROLES, 'Administrador técnico'],
  auditoria: ['Jefatura', ROLE_SUPER, 'Administrador técnico'],
  usuarios: [ROLE_SUPER, 'Administrador técnico'],
  configuracion: [ROLE_SUPER, 'Administrador técnico'],
};
const PERMISSIONS = {
  createRequest: ['Solicitante', 'Comprador'],
  uploadDocument: ['Solicitante', 'Comprador', READ_ONLY_ROLE],
  quote: ['Comprador'],
  requestApproval: ['Comprador'],
  award: ['Comprador'],
  closeContract: ['Comprador'],
  executePayment: ['Comprador'],
  delegate: ['Comprador'],
  directDeal: ['Comprador'],
  reassign: ['Jefatura', ROLE_SUPER],
  overdraft: ['Comprador', 'Jefatura', ROLE_SUPER],
  manageFunds: ['Jefatura', ROLE_SUPER],
  addFunds: ['Jefatura'], // abonar (registrar asignación): exclusivo de Jefatura
};

const routeLabels = {
  dashboard: 'Inicio',
  solicitudes: 'Solicitudes',
  'mis-compras': 'Mis compras',
  cotizaciones: 'Evaluación de cotizaciones',
  aprobaciones: 'Visado',
  contratos: 'Contratos',
  'presupuesto': 'Presupuesto',
  'renovacion-equipos': 'Renovación de equipos',
  'fondos-insuficientes': 'Fondos insuficientes',
  proveedores: 'Proveedores',
  auditoria: 'Auditoría',
  usuarios: 'Usuarios',
  configuracion: 'Configuración',
};

const processSteps = [
  ['Borrador', 'Borrador'],
  ['Cotización', 'En cotización'],
  ['Evaluación', 'En evaluación'],
  ['En visado', 'En visado'],
  ['Visada', 'Visada'],
  ['Adjudicada', 'Adjudicada'],
  ['Contrato', 'Contrato activo'],
  ['Cerrado', 'Contrato cerrado'],
];
const CLOSED_STATUSES = ['Abortada', 'Rechazada', 'Contrato cerrado'];
const PRE_APPROVAL_STATUSES = ['Borrador', 'En cotización', 'En evaluación', 'En visado', 'Devuelta con observaciones'];
const MIN_NOTE_CHARS = 10;
const ADD_FUNDS_MESSAGE = 'Solo Jefatura puede abonar presupuesto';
const CONTRACT_ATTACH_MESSAGE = 'Adjunta el contrato firmado y timbrado para cerrar';
// Categorías de equipos de EJEMPLO (confirmar criterios con el cliente).
const EQUIPMENT_CATEGORIES = { A: 'Infraestructura crítica', B: 'Puesto de trabajo', C: 'Complementario' };
const RENEWAL_MONTHS = 36;

/* ===== Utilidades ===== */
const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const icon = (name, size = 16) => `<i data-lucide="${name}" width="${size}" height="${size}" aria-hidden="true"></i>`;
const formatCLP = (value = 0) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value) || 0);
const formatNumber = (value = 0) => new Intl.NumberFormat('es-CL').format(Number(value) || 0);
const formatScore = (value) => Number(value).toFixed(2).replace('.', ',');
const parseDate = (value) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value));
const formatDate = (value) => value ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parseDate(value)) : '—';
const formatDateTime = (value) => value ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(parseDate(value)) : '—';
const dateKey = (value) => { const d = parseDate(value); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const todayISO = () => new Date().toISOString();

/* ===== Visado por tramos ===== */
function getTier(amount) { return APPROVAL_TIERS.find((tier) => Number(amount) <= tier.maxAmount) || APPROVAL_TIERS[APPROVAL_TIERS.length - 1]; }
function tierIndex(tier) { return APPROVAL_TIERS.indexOf(tier); }
function tierRangeText(tier) {
  const index = tierIndex(tier);
  if (index === 0) return `Hasta ${formatCLP(tier.maxAmount)}`;
  const previous = APPROVAL_TIERS[index - 1].maxAmount;
  if (tier.maxAmount === Infinity) return `Sobre ${formatCLP(previous)}`;
  return `Desde ${formatCLP(previous + 1)} hasta ${formatCLP(tier.maxAmount)}`;
}
function roleRank(role) { return APPROVAL_TIERS.findIndex((tier) => tier.approverRole === role) + 1; }
function canVisar(role, amount) { return roleRank(role) > tierIndex(getTier(amount)); }
const isReadOnly = (role = state.currentUser.role) => role === READ_ONLY_ROLE;
// Un usuario dado de baja no puede ingresar ni entrar con su perfil desde el selector de rol.
const profileUser = (role) => state.users.find((user) => user.id === ROLE_PROFILES[role].id);
const isRoleActive = (role) => (profileUser(role)?.status ?? 'Activo') === 'Activo';
const inactiveMessage = (role) => `Acceso denegado: el usuario ${profileUser(role).name} (${role}) está inactivo`;
function visadoBlockText(request, role = state.currentUser.role) {
  if (isReadOnly(role)) return READ_ONLY_MESSAGE;
  const tier = getTier(request.amount);
  return roleRank(role) === 0 ? `Tu rol (${role}) no tiene atribución de visado. ${tier.blockMessage}` : tier.blockMessage;
}
function roleSummary(role) {
  const tier = APPROVAL_TIERS.find((item) => item.approverRole === role);
  if (!tier) return ROLE_PROFILES[role].summary;
  const index = tierIndex(tier);
  const lower = index > 0 ? ' y los tramos inferiores' : '';
  return `${index === APPROVAL_TIERS.length - 1 ? 'Máxima jerarquía. ' : ''}Visa compras: ${tierRangeText(tier).toLowerCase()}${lower}.`;
}

/* ===== Permisos y rutas ===== */
const can = (permission, role = state.currentUser.role) => PERMISSIONS[permission].includes(role);
const canAccess = (route, role = state.currentUser.role) => (ROUTE_ACCESS[route] || ROLES).includes(role);

/* ===== Presupuesto (libro de movimientos) ===== */
// Efecto de cada tipo de movimiento. Una aprobación descuenta el disponible comprometido UNA sola vez;
// devengar no vuelve a descontar y ejecutar el pago solo reduce el saldo real.
const LEDGER_FX = {
  'Asignación': { real: 1, committed: 1 },
  Aprobado: { real: 0, committed: -1 },
  Devengado: { real: 0, committed: 0 },
  Ejecutado: { real: -1, committed: 0 },
  Anulado: { real: 0, committed: 1 },
};
const LEDGER_TOTAL_KEY = { 'Asignación': 'asignado', Aprobado: 'aprobado', Devengado: 'devengado', Anulado: 'anulado', Ejecutado: 'ejecutado' };
const LEDGER_STATUS_OPTIONS = [['real', 'Real (ejecutado)'], ['comprometido', 'Comprometido (aprobado/devengado)'], ['asignacion', 'Asignación de fondo'], ['anulado', 'Anulado']];

function ledgerStatus(type) {
  if (type === 'Ejecutado') return { key: 'real', label: 'Real (ejecutado)', short: 'Real', tone: 'real' };
  if (type === 'Aprobado' || type === 'Devengado') return { key: 'comprometido', label: 'Comprometido (aprobado/devengado)', short: 'Comprometido', tone: 'committed' };
  if (type === 'Anulado') return { key: 'anulado', label: 'Anulado', short: 'Anulado', tone: 'void' };
  return { key: 'asignacion', label: 'Asignación de fondo', short: 'Asignación', tone: 'fund' };
}

function computeAccount(year = state.settings.currentYear) {
  let real = 0; let committed = 0;
  const totals = { asignado: 0, aprobado: 0, devengado: 0, anulado: 0, ejecutado: 0 };
  const lines = state.ledger.filter((row) => row.year === Number(year)).map((row) => {
    const fx = LEDGER_FX[row.type];
    const dReal = fx.real * row.amount; const dCommitted = fx.committed * row.amount;
    real += dReal; committed += dCommitted;
    totals[LEDGER_TOTAL_KEY[row.type]] += row.amount;
    const request = row.requestId ? getRequest(row.requestId) : null;
    return { ...row, dReal, dCommitted, balanceReal: real, balanceCommitted: committed, request, providerName: request ? (getProvider(request.awardedProviderId)?.name || 'Por adjudicar') : '—', responsible: request ? request.buyer : row.user, department: request ? request.department : '—' };
  });
  const comprometido = totals.aprobado - totals.anulado;
  const saldoReal = totals.asignado - totals.ejecutado;
  const saldoComprometido = totals.asignado - comprometido;
  return { year: Number(year), lines, ...totals, comprometido, saldoReal, saldoComprometido, reconciles: saldoReal === real && saldoComprometido === committed };
}

function postLedger({ type, requestId = null, amount, description = '', year, date = todayISO(), user = state.currentUser.name }) {
  const request = requestId ? getRequest(requestId) : null;
  const row = { id: `MOV-${String(state.ledger.length + 1).padStart(3, '0')}`, date, year: year || request?.year || new Date(date).getFullYear(), type, requestId, amount, user, description };
  state.ledger.push(row);
  return row;
}

function hasInsufficientFunds(request) { return !request.overBudget && request.amount > computeAccount(request.year).saldoComprometido; }

/* ===== Evaluación de cotizaciones ===== */
// Puntaje ponderado: 50% valor económico, 25% calidad técnica, 25% entrega. Se compara en enteros (puntos = 2e + t + d) para evitar errores de decimales.
const quotePoints = (quote) => (2 * (quote.economic || 0)) + (quote.technical || 0) + (quote.delivery || 0);
const calculateQuoteScore = (quote) => quotePoints(quote) / 4;

function getScoredQuotes(requestId) {
  return getQuotes(requestId).map((quote) => ({ ...quote, provider: getProvider(quote.providerId), points: quotePoints(quote), score: calculateQuoteScore(quote) })).sort((a, b) => b.points - a.points);
}

function getTieInfo(request) {
  const scored = getScoredQuotes(request.id);
  const tied = scored.length ? scored.filter((quote) => quote.points === scored[0].points) : [];
  const isTie = tied.length > 1;
  const decision = request.tieBreak && tied.some((quote) => quote.id === request.tieBreak.quoteId) ? request.tieBreak : null;
  return { scored, tied, isTie, decision, resolved: !isTie || Boolean(decision) };
}

/* ===== Datos de ejemplo ===== */
function createInitialState() {
  const req = (id, department, description, quantity, amount, requiredDate, requester, buyer, status, createdAt, extra = {}) => ({ id, department, description, quantity, amount, requiredDate, requester, buyer, ownerOriginal: buyer, status, year: Number(id.slice(4, 8)), createdAt, observations: '', directDeal: false, overBudget: false, ...extra });
  const requests = [
    req('SOL-2026-017', 'Obras Municipales', 'Adquisición de camión recolector de residuos', 1, 75000000, '2026-12-15', 'Diego Soto', 'Felipe Rojas', 'En visado', '2026-10-05T09:30:00', { observations: 'Reposición de camión fuera de servicio por falla mayor.' }),
    req('SOL-2026-016', 'Obras Municipales', 'Reposición de veredas en calle San Diego', 1, 24500000, '2026-11-20', 'Diego Soto', 'Ana Silva', 'En visado', '2026-09-28T11:15:00', { observations: 'Incluye demolición, base granular y hormigón.' }),
    req('SOL-2026-015', 'Medio Ambiente', 'Renovación de luminarias LED en plazas', 120, 16800000, '2026-11-10', 'Tomás Araya', 'Ana Silva', 'Visada', '2026-09-22T10:00:00', { observations: 'Dos ofertas obtuvieron el mismo puntaje ponderado.' }),
    req('SOL-2026-014', 'Finanzas', 'Adquisición de notebooks', 10, 12500000, '2026-10-30', 'Carlos Pérez', 'Ana Silva', 'En visado', '2026-09-04T09:42:00', { ownerOriginal: 'Juan Soto', observations: 'Equipamiento para renovación de puestos críticos.' }),
    req('SOL-2026-013', 'DIDECO', 'Servicio de producción feria comunitaria', 1, 7800000, '2026-10-14', 'Sofía Morales', 'Ana Silva', 'En visado', '2026-09-01T10:18:00', { observations: 'Incluye montaje, sonido y apoyo logístico.' }),
    req('SOL-2026-012', 'Obras Municipales', 'Mantención preventiva de vehículos', 4, 18500000, '2026-09-28', 'Diego Soto', 'Felipe Rojas', 'Adjudicada', '2026-08-21T15:20:00', { awardedProviderId: 'PROV-004' }),
    req('SOL-2026-011', 'Salud', 'Insumos para operativo rural', 22, 4200000, '2026-09-20', 'Paula Vega', 'Ana Silva', 'Contrato activo', '2026-08-12T11:05:00', { awardedProviderId: 'PROV-001' }),
    req('SOL-2026-010', 'Educación', 'Material didáctico para escuelas', 1, 6200000, '2026-08-30', 'Camila Fuentes', 'Felipe Rojas', 'Contrato cerrado', '2026-07-26T08:35:00', { awardedProviderId: 'PROV-004' }),
    req('SOL-2026-009', 'Secretaría Municipal', 'Licencias de firma digital', 35, 2100000, '2026-07-24', 'María González', 'Ana Silva', 'Devuelta con observaciones', '2026-07-08T12:03:00', { directDeal: true, observations: 'Revisar vigencia y usuarios incluidos.' }),
    req('SOL-2026-008', 'Medio Ambiente', 'Campaña de arborización urbana', 1, 9500000, '2026-06-30', 'Tomás Araya', 'Ana Silva', 'Abortada', '2026-04-20T09:00:00', { observations: 'Proceso abortado por cambio de alcance; se liberó el monto aprobado.' }),
    req('SOL-2026-006', 'Obras Municipales', 'Señalética vial y paraderos', 1, 31500000, '2026-06-15', 'Diego Soto', 'Felipe Rojas', 'Contrato cerrado', '2026-03-05T10:30:00', { awardedProviderId: 'PROV-003' }),
    req('SOL-2026-004', 'Finanzas', 'Renovación de servidores institucionales', 4, 14200000, '2026-03-10', 'Carlos Pérez', 'Felipe Rojas', 'Contrato cerrado', '2026-01-28T10:00:00', { awardedProviderId: 'PROV-001' }),
    req('SOL-2025-041', 'Medio Ambiente', 'Monitoreo de calidad del aire', 1, 9800000, '2025-11-15', 'Tomás Araya', 'Felipe Rojas', 'Abortada', '2025-10-02T14:45:00', { observations: 'Proceso abortado por cambio de alcance.' }),
    req('SOL-2025-038', 'Obras Municipales', 'Mantención de alumbrado público', 1, 28000000, '2025-11-30', 'Diego Soto', 'Felipe Rojas', 'Contrato cerrado', '2025-08-25T09:00:00', { awardedProviderId: 'PROV-003' }),
  ];

  let quoteCount = 0;
  const quotes = (date, createdBy, list) => list.map(([providerId, price, economic, technical, delivery], index) => ({ id: `COT-${String(++quoteCount).padStart(3, '0')}`, providerId, price, economic, technical, delivery, createdBy, createdAt: `${date}T${String(9 + index * 2).padStart(2, '0')}:10:00` }));

  const users = [
    { id: 'USR-001', name: 'Carlos Pérez', role: 'Solicitante', department: 'Finanzas', status: 'Activo', lastAccess: '2026-10-09T08:42:00' },
    { id: 'USR-002', name: 'María González', role: 'Jefatura', department: 'Administración', status: 'Activo', lastAccess: '2026-10-09T09:05:00' },
    { id: 'USR-003', name: 'Ana Silva', role: 'Comprador', department: 'Abastecimiento', status: 'Activo', lastAccess: '2026-10-09T09:18:00' },
    { id: 'USR-004', name: 'Felipe Rojas', role: 'Comprador', department: 'Abastecimiento', status: 'Activo', lastAccess: '2026-10-08T16:30:00' },
    { id: 'USR-005', name: 'Javiera León', role: 'Administrador técnico', department: 'Tecnología', status: 'Activo', lastAccess: '2026-10-08T12:15:00' },
    { id: 'USR-006', name: 'Martín Pérez', role: 'Pasante', department: 'Administración', status: 'Activo', lastAccess: '2026-10-07T14:20:00' },
    { id: 'USR-007', name: 'Roberto Mena', role: 'Supervisor', department: 'Abastecimiento', status: 'Activo', lastAccess: '2026-10-09T10:02:00' },
    { id: 'USR-008', name: 'Patricio Contreras', role: ROLE_SUPER, department: 'Administración Municipal', status: 'Activo', lastAccess: '2026-10-09T10:40:00' },
  ];

  const apr = (id, requestId, status, requestedBy, requestedAt, decidedBy = null, decidedAt = null, note = '') => {
    const request = requests.find((item) => item.id === requestId);
    const tier = getTier(request.amount);
    return { id, requestId, status, amount: request.amount, requiredRole: tier.approverRole, requestedBy, requestedAt, decidedBy, decidedRole: decidedBy ? users.find((user) => user.name === decidedBy).role : null, decidedAt, note };
  };
  const approvals = [
    apr('APR-001', 'SOL-2026-014', 'Devuelta', 'Ana Silva', '2026-09-06T14:02:00', 'María González', '2026-09-07T09:15:00', 'Se solicita revisar antecedentes técnicos del proveedor B.'),
    apr('APR-002', 'SOL-2026-009', 'Devuelta', 'Ana Silva', '2026-07-11T10:00:00', 'Roberto Mena', '2026-07-12T09:15:00', 'Se solicita revisar vigencia y usuarios incluidos.'),
    apr('APR-003', 'SOL-2026-004', 'Aprobada', 'Felipe Rojas', '2026-02-09T16:00:00', 'María González', '2026-02-10T10:20:00'),
    apr('APR-004', 'SOL-2026-006', 'Aprobada', 'Felipe Rojas', '2026-03-19T15:30:00', 'Patricio Contreras', '2026-03-20T11:05:00'),
    apr('APR-005', 'SOL-2026-008', 'Aprobada', 'Ana Silva', '2026-05-05T12:00:00', 'Roberto Mena', '2026-05-06T09:40:00'),
    apr('APR-006', 'SOL-2026-010', 'Aprobada', 'Felipe Rojas', '2026-07-29T11:20:00', 'Roberto Mena', '2026-07-30T15:10:00'),
    apr('APR-007', 'SOL-2026-011', 'Aprobada', 'Ana Silva', '2026-08-26T16:40:00', 'Roberto Mena', '2026-08-27T10:45:00'),
    apr('APR-008', 'SOL-2026-012', 'Aprobada', 'Felipe Rojas', '2026-09-01T09:50:00', 'María González', '2026-09-02T12:00:00'),
    apr('APR-009', 'SOL-2026-015', 'Aprobada', 'Ana Silva', '2026-10-05T10:15:00', 'María González', '2026-10-06T14:25:00'),
    apr('APR-010', 'SOL-2026-014', 'Pendiente', 'Ana Silva', '2026-09-07T14:02:00'),
    apr('APR-011', 'SOL-2026-013', 'Pendiente', 'Ana Silva', '2026-09-09T11:30:00'),
    apr('APR-012', 'SOL-2026-016', 'Pendiente', 'Ana Silva', '2026-10-01T10:00:00'),
    apr('APR-013', 'SOL-2026-017', 'Pendiente', 'Felipe Rojas', '2026-10-06T09:20:00'),
    apr('APR-014', 'SOL-2025-038', 'Aprobada', 'Felipe Rojas', '2025-09-09T10:00:00', 'Patricio Contreras', '2025-09-10T09:30:00'),
    apr('APR-015', 'SOL-2025-041', 'Aprobada', 'Felipe Rojas', '2025-10-19T10:00:00', 'Roberto Mena', '2025-10-20T10:10:00'),
  ];

  const contracts = [
    { id: 'CT-015', requestId: 'SOL-2026-012', providerId: 'PROV-004', amount: 18500000, buyer: 'Felipe Rojas', status: 'Activo', awardedAt: '2026-09-05T12:10:00', devengo: false, paid: false },
    { id: 'CT-014', requestId: 'SOL-2026-010', providerId: 'PROV-004', amount: 6200000, buyer: 'Felipe Rojas', status: 'Cerrado', awardedAt: '2026-08-01T12:10:00', closedAt: '2026-09-20T16:00:00', signedDoc: { name: 'Contrato_CT-014_firmado_timbrado.pdf', at: '2026-09-18T15:20:00', by: 'Felipe Rojas' }, devengo: true, paid: false },
    { id: 'CT-013', requestId: 'SOL-2026-011', providerId: 'PROV-001', amount: 4200000, buyer: 'Ana Silva', status: 'Activo', awardedAt: '2026-08-28T12:10:00', devengo: false, paid: false },
    { id: 'CT-011', requestId: 'SOL-2026-006', providerId: 'PROV-003', amount: 31500000, buyer: 'Felipe Rojas', status: 'Cerrado', awardedAt: '2026-04-02T12:00:00', closedAt: '2026-05-12T16:00:00', signedDoc: { name: 'Contrato_CT-011_firmado_timbrado.pdf', at: '2026-05-11T15:40:00', by: 'Felipe Rojas' }, devengo: true, paid: true },
    { id: 'CT-010', requestId: 'SOL-2026-004', providerId: 'PROV-001', amount: 14200000, buyer: 'Felipe Rojas', status: 'Cerrado', awardedAt: '2026-02-20T12:00:00', closedAt: '2026-03-04T16:00:00', signedDoc: { name: 'Contrato_CT-010_firmado_timbrado.pdf', at: '2026-03-03T15:10:00', by: 'Felipe Rojas' }, devengo: true, paid: true },
    { id: 'CT-008', requestId: 'SOL-2025-038', providerId: 'PROV-003', amount: 28000000, buyer: 'Felipe Rojas', status: 'Cerrado', awardedAt: '2025-10-02T12:00:00', closedAt: '2025-11-20T16:00:00', signedDoc: { name: 'Contrato_CT-008_firmado_timbrado.pdf', at: '2025-11-19T15:30:00', by: 'Felipe Rojas' }, devengo: true, paid: true },
  ];

  let ledgerCount = 0;
  const mov = (date, type, requestId, amount, user, description = '') => ({ id: `MOV-${String(++ledgerCount).padStart(3, '0')}`, date, year: requestId ? Number(requestId.slice(4, 8)) : Number(date.slice(0, 4)), type, requestId, amount, user, description });
  const ledger = [
    mov('2025-01-03', 'Asignación', null, 60000000, 'María González', 'Presupuesto inicial 2025'),
    mov('2025-09-10', 'Aprobado', 'SOL-2025-038', 28000000, 'Patricio Contreras', 'Visado del Superusuario'),
    mov('2025-10-20', 'Aprobado', 'SOL-2025-041', 9800000, 'Roberto Mena', 'Visado del Supervisor'),
    mov('2025-11-02', 'Anulado', 'SOL-2025-041', 9800000, 'Felipe Rojas', 'Proceso abortado por cambio de alcance'),
    mov('2025-11-20', 'Devengado', 'SOL-2025-038', 28000000, 'Felipe Rojas', 'Cierre del contrato CT-008'),
    mov('2025-12-15', 'Ejecutado', 'SOL-2025-038', 28000000, 'Felipe Rojas', 'Pago del contrato CT-008'),
    mov('2026-01-02', 'Asignación', null, 130000000, 'María González', 'Presupuesto inicial 2026'),
    mov('2026-02-10', 'Aprobado', 'SOL-2026-004', 14200000, 'María González', 'Visado de Jefatura'),
    mov('2026-03-04', 'Devengado', 'SOL-2026-004', 14200000, 'Felipe Rojas', 'Cierre del contrato CT-010'),
    mov('2026-03-15', 'Ejecutado', 'SOL-2026-004', 14200000, 'Felipe Rojas', 'Pago del contrato CT-010'),
    mov('2026-03-20', 'Aprobado', 'SOL-2026-006', 31500000, 'Patricio Contreras', 'Visado del Superusuario'),
    mov('2026-05-06', 'Aprobado', 'SOL-2026-008', 9500000, 'Roberto Mena', 'Visado del Supervisor'),
    mov('2026-05-12', 'Devengado', 'SOL-2026-006', 31500000, 'Felipe Rojas', 'Cierre del contrato CT-011'),
    mov('2026-05-20', 'Anulado', 'SOL-2026-008', 9500000, 'Ana Silva', 'Proceso abortado por cambio de alcance'),
    mov('2026-06-02', 'Ejecutado', 'SOL-2026-006', 31500000, 'Felipe Rojas', 'Pago del contrato CT-011'),
    mov('2026-06-03', 'Asignación', null, 20000000, 'María González', 'Refuerzo presupuestario'),
    mov('2026-07-30', 'Aprobado', 'SOL-2026-010', 6200000, 'Roberto Mena', 'Visado del Supervisor'),
    mov('2026-08-27', 'Aprobado', 'SOL-2026-011', 4200000, 'Roberto Mena', 'Visado del Supervisor'),
    mov('2026-09-02', 'Aprobado', 'SOL-2026-012', 18500000, 'María González', 'Visado de Jefatura'),
    mov('2026-09-20', 'Devengado', 'SOL-2026-010', 6200000, 'Felipe Rojas', 'Cierre del contrato CT-014'),
    mov('2026-10-06', 'Aprobado', 'SOL-2026-015', 16800000, 'María González', 'Visado de Jefatura'),
  ];

  const providers = [
    { id: 'PROV-001', name: 'TecnoSur SpA', rut: '76.345.821-4', contact: 'contacto@tecnosur.cl', processes: 8, total: 48600000, compliance: 86, status: 'Activo', offeredDays: 10, actualDays: 12 },
    { id: 'PROV-002', name: 'Digital Andes Ltda.', rut: '77.218.904-1', contact: 'ventas@digitalandes.cl', processes: 5, total: 28100000, compliance: 94, status: 'Activo', offeredDays: 12, actualDays: 11 },
    { id: 'PROV-003', name: 'Equipamiento Central', rut: '76.982.114-8', contact: 'licitaciones@equipocentral.cl', processes: 3, total: 22000000, compliance: 72, status: 'Activo', offeredDays: 15, actualDays: 20 },
    { id: 'PROV-004', name: 'Servicios Cordillera', rut: '77.455.610-2', contact: 'hola@cordillera.cl', processes: 6, total: 35400000, compliance: 91, status: 'Activo', offeredDays: 8, actualDays: 8 },
    { id: 'PROV-005', name: 'Nexo Productora', rut: '76.711.332-0', contact: 'comercial@nexo.cl', processes: 2, total: 11900000, compliance: 80, status: 'Activo', offeredDays: 7, actualDays: 9 },
  ];

  // Auditoría de ejemplo derivada de los mismos datos para que historial, visados y movimientos cuenten la misma historia.
  const events = [];
  const push = (at, user, action, object, previous, next, note = '') => events.push({ at, user, role: users.find((item) => item.name === user)?.role, action, object, previous, next, note });
  requests.forEach((request) => push(request.createdAt, request.requester, `creó ${request.id}`, request.id, '—', 'Borrador'));
  approvals.forEach((approval) => {
    push(approval.requestedAt, approval.requestedBy, 'solicitó visado', approval.requestId, 'En evaluación', 'En visado');
    if (approval.status === 'Pendiente') return;
    const decided = { Aprobada: ['aprobó la compra', 'Visada'], Devuelta: ['devolvió la compra con observaciones', 'Devuelta con observaciones'] }[approval.status];
    push(approval.decidedAt, approval.decidedBy, decided[0], approval.requestId, 'En visado', decided[1], approval.note);
  });
  contracts.forEach((contract) => {
    push(contract.awardedAt, contract.buyer, `adjudicó a ${providers.find((item) => item.id === contract.providerId).name}`, contract.requestId, 'Visada', 'Adjudicada');
    if (contract.signedDoc) push(contract.signedDoc.at, contract.signedDoc.by, `adjuntó el contrato firmado y timbrado (${contract.signedDoc.name})`, contract.requestId, 'Contrato sin adjunto', 'Contrato adjunto');
    if (contract.closedAt) push(contract.closedAt, contract.buyer, `cerró el contrato ${contract.id}`, contract.requestId, 'Contrato activo', 'Contrato cerrado');
  });
  ledger.filter((row) => row.type === 'Ejecutado').forEach((row) => push(`${row.date}T12:00:00`, row.user, 'marcó pago ejecutado', row.requestId, 'Devengado', 'Ejecutado'));
  ledger.filter((row) => row.type === 'Anulado').forEach((row) => push(`${row.date}T12:00:00`, row.user, 'abortó la compra y liberó el monto aprobado', row.requestId, 'Visada', 'Abortada', row.description));
  push('2026-09-07T13:40:00', 'Ana Silva', 'modificó antecedentes', 'SOL-2026-014', 'Devuelta con observaciones', 'Devuelta con observaciones', 'Se actualizó el cuadro comparativo.');
  events.sort((a, b) => new Date(a.at) - new Date(b.at));
  const auditEvents = events.map((event, index) => ({ id: `AUD-${String(index + 1).padStart(3, '0')}`, ...event })).reverse();

  return {
    session: { loggedIn: false },
    selectedRequestId: 'SOL-2026-014',
    detailTabs: {},
    currentUser: { id: ROLE_PROFILES.Comprador.id, name: ROLE_PROFILES.Comprador.name, role: 'Comprador', initials: 'AS', department: ROLE_PROFILES.Comprador.department },
    requests,
    quotes: {
      'SOL-2026-017': quotes('2026-10-05', 'Felipe Rojas', [['PROV-003', 75000000, 5, 6, 6], ['PROV-001', 72900000, 6, 5, 6], ['PROV-002', 79200000, 4, 7, 6]]),
      'SOL-2026-016': quotes('2026-09-29', 'Ana Silva', [['PROV-004', 24500000, 6, 5, 5], ['PROV-003', 25300000, 5, 6, 5], ['PROV-002', 26100000, 4, 6, 6]]),
      'SOL-2026-015': quotes('2026-09-23', 'Ana Silva', [['PROV-003', 16200000, 6, 5, 5], ['PROV-002', 16800000, 5, 6, 6], ['PROV-001', 17100000, 4, 6, 5]]),
      'SOL-2026-014': quotes('2026-09-05', 'Ana Silva', [['PROV-001', 11800000, 7, 5, 4], ['PROV-002', 12100000, 6, 6, 6], ['PROV-003', 12500000, 5, 6, 7]]),
      'SOL-2026-013': quotes('2026-09-02', 'Ana Silva', [['PROV-004', 7400000, 6, 6, 5], ['PROV-005', 7800000, 5, 7, 5], ['PROV-002', 8100000, 4, 6, 6]]),
      'SOL-2026-012': quotes('2026-08-25', 'Felipe Rojas', [['PROV-004', 18500000, 7, 5, 5], ['PROV-003', 19200000, 6, 5, 5], ['PROV-001', 19900000, 5, 6, 5]]),
      'SOL-2026-011': quotes('2026-08-14', 'Ana Silva', [['PROV-001', 4200000, 7, 5, 5], ['PROV-003', 4500000, 6, 5, 5], ['PROV-004', 4800000, 5, 6, 5]]),
      'SOL-2026-010': quotes('2026-07-28', 'Felipe Rojas', [['PROV-004', 6200000, 7, 6, 5], ['PROV-005', 6500000, 6, 5, 5], ['PROV-002', 6900000, 4, 6, 6]]),
      'SOL-2026-009': quotes('2026-07-10', 'Ana Silva', [['PROV-002', 2100000, 7, 5, 5]]),
      'SOL-2026-008': quotes('2026-04-22', 'Ana Silva', [['PROV-005', 9500000, 7, 5, 5], ['PROV-004', 9900000, 6, 5, 5], ['PROV-002', 10400000, 5, 5, 5]]),
      'SOL-2026-006': quotes('2026-03-08', 'Felipe Rojas', [['PROV-003', 31500000, 7, 5, 5], ['PROV-004', 33000000, 6, 5, 6], ['PROV-002', 34200000, 5, 7, 6]]),
      'SOL-2026-004': quotes('2026-02-01', 'Felipe Rojas', [['PROV-001', 14200000, 7, 6, 5], ['PROV-002', 14900000, 6, 6, 6], ['PROV-005', 15300000, 5, 6, 6]]),
      'SOL-2025-041': quotes('2025-10-06', 'Felipe Rojas', [['PROV-005', 9800000, 7, 5, 5], ['PROV-004', 10100000, 6, 5, 5], ['PROV-002', 10600000, 5, 5, 6]]),
      'SOL-2025-038': quotes('2025-08-28', 'Felipe Rojas', [['PROV-003', 28000000, 7, 5, 6], ['PROV-004', 29500000, 6, 6, 5], ['PROV-001', 30100000, 5, 6, 6]]),
    },
    approvals,
    contracts,
    ledger,
    equipment: [
      { id: 'EQ-0412', name: 'Notebook Latitude 5420', category: 'B', department: 'Finanzas', holder: 'Carlos Pérez', startDate: '2023-03-14', renewalRequestId: 'SOL-2026-014' },
      { id: 'EQ-0413', name: 'Notebook Latitude 5420', category: 'B', department: 'Finanzas', holder: 'Pamela Rivas', startDate: '2023-05-22', renewalRequestId: 'SOL-2026-014' },
      { id: 'EQ-0208', name: 'Switch de red 48 puertos', category: 'A', department: 'Tecnología', holder: 'Javiera León', startDate: '2022-08-10', renewalRequestId: null },
      { id: 'EQ-0530', name: 'Servidor de aplicaciones', category: 'A', department: 'Tecnología', holder: 'Javiera León', startDate: '2026-03-04', renewalRequestId: null },
      { id: 'EQ-0377', name: 'Tablet de inspección', category: 'C', department: 'Obras Municipales', holder: 'Diego Soto', startDate: '2023-01-20', renewalRequestId: null },
      { id: 'EQ-0391', name: 'Computador de escritorio', category: 'B', department: 'DIDECO', holder: 'Sofía Morales', startDate: '2023-12-05', renewalRequestId: null },
      { id: 'EQ-0455', name: 'Impresora multifuncional', category: 'C', department: 'Secretaría Municipal', holder: 'María González', startDate: '2024-06-18', renewalRequestId: null },
      { id: 'EQ-0488', name: 'Notebook Latitude 3440', category: 'B', department: 'Salud', holder: 'Paula Vega', startDate: '2025-09-01', renewalRequestId: null },
      { id: 'EQ-0502', name: 'Proyector multimedia', category: 'C', department: 'Educación', holder: 'Camila Fuentes', startDate: '2025-02-11', renewalRequestId: null },
    ],
    providers,
    users,
    documents: [
      { id: 'DOC-001', requestId: 'SOL-2026-014', name: 'Especificaciones técnicas.pdf', type: 'Antecedente técnico', uploadedBy: 'Carlos Pérez', date: '2026-09-04', status: 'Vigente' },
      { id: 'DOC-002', requestId: 'SOL-2026-014', name: 'Cuadro comparativo.xlsx', type: 'Evaluación', uploadedBy: 'Ana Silva', date: '2026-09-06', status: 'Vigente' },
      { id: 'DOC-003', requestId: 'SOL-2026-010', name: 'Acta de recepción.pdf', type: 'Cierre', uploadedBy: 'Felipe Rojas', date: '2026-09-20', status: 'Vigente' },
      { id: 'DOC-004', requestId: 'SOL-2026-015', name: 'Cuadro comparativo.xlsx', type: 'Evaluación', uploadedBy: 'Ana Silva', date: '2026-09-30', status: 'Vigente' },
      ...contracts.filter((contract) => contract.signedDoc).map((contract, index) => ({ id: `DOC-${String(5 + index).padStart(3, '0')}`, requestId: contract.requestId, name: contract.signedDoc.name, type: 'Contrato firmado y timbrado', uploadedBy: contract.signedDoc.by, date: contract.signedDoc.at.slice(0, 10), status: 'Vigente' })),
    ],
    auditEvents,
    settings: { currentYear: 2026 },
    filters: {},
    modalTrigger: null,
  };
}

let state = createInitialState();

/* ===== Acceso a datos ===== */
function getRoute() {
  const raw = (location.hash || '#dashboard').slice(1).split('?')[0];
  const parts = raw.split('/').filter(Boolean);
  const route = parts[0] === 'cuenta-corriente' ? 'presupuesto' : (parts[0] || 'dashboard'); // '#cuenta-corriente' (nombre anterior) sigue funcionando
  return { route, id: parts[1] || null, tab: parts[2] || 'resumen' };
}

function navigate(route, id = null, tab = null) {
  const next = `#${route}${id ? `/${id}` : ''}${tab && tab !== 'resumen' ? `/${tab}` : ''}`;
  if (location.hash === next) renderApp();
  else location.hash = next;
  closeModal();
}

function getRequest(id) { return state.requests.find((request) => request.id === id); }
function getProvider(id) { return state.providers.find((provider) => provider.id === id); }
function getContract(requestId) { return state.contracts.find((contract) => contract.requestId === requestId); }
function getQuotes(requestId) { return state.quotes[requestId] || []; }
function getInitials(name) { return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase(); }
function getPendingApproval(requestId) { return state.approvals.filter((approval) => approval.requestId === requestId && approval.status === 'Pendiente').pop(); }
function pendingRequests() { return state.requests.filter((request) => request.status === 'En visado'); }
function pendingForRole(role) { return pendingRequests().filter((request) => canVisar(role, request.amount)); }
function visibleRequests() { const user = state.currentUser; return user.role === 'Solicitante' ? state.requests.filter((request) => request.requester === user.name) : state.requests; }
function nextContractId() { return `CT-${String(Math.max(0, ...state.contracts.map((contract) => Number(contract.id.replace('CT-', '')))) + 1).padStart(3, '0')}`; }

function setCurrentRole(role) {
  const profile = ROLE_PROFILES[role];
  state.currentUser = { id: profile.id, name: profile.name, role, initials: getInitials(profile.name), department: profile.department };
}

function showToast(message, tone = 'success') {
  const root = document.querySelector('#toast-root');
  if (!root) return;
  const toast = document.createElement('div');
  toast.className = `toast ${tone}`;
  toast.innerHTML = `${icon(tone === 'error' ? 'circle-x' : tone === 'warning' ? 'triangle-alert' : 'circle-check', 18)}<span>${esc(message)}</span><button type="button" data-action="dismiss-toast" aria-label="Cerrar aviso">${icon('x', 16)}</button>`;
  root.appendChild(toast);
  if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
  window.setTimeout(() => toast.remove(), 6000);
}

function addAuditEvent({ action, object, previous = '—', next = '—', note = '', user = state.currentUser.name, role = state.currentUser.role }) {
  state.auditEvents.unshift({ id: `AUD-${String(state.auditEvents.length + 1).padStart(3, '0')}`, at: todayISO(), user, role, action, object, previous, next, note });
}

function renderIcons() {
  if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
}

function openModal(content, options = {}) {
  state.modalTrigger = document.activeElement;
  const root = document.querySelector('#modal-root');
  root.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal ${options.wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">${content}</section></div>`;
  document.body.style.overflow = 'hidden';
  const focusable = root.querySelector('input, select, textarea, button');
  if (focusable) window.setTimeout(() => focusable.focus(), 0);
  renderIcons();
}

function closeModal() {
  const root = document.querySelector('#modal-root');
  if (root) root.innerHTML = '';
  document.body.style.overflow = '';
  if (state.modalTrigger && typeof state.modalTrigger.focus === 'function') state.modalTrigger.focus();
  state.modalTrigger = null;
}

/* ===== Componentes de interfaz ===== */
function renderLogo(extraClass = '') {
  if (!LOGO_SRC) return `<span class="logo-placeholder ${extraClass}">${esc(MUNICIPALITY_NAME)}</span>`;
  return `<img class="logo-img ${extraClass}" src="${esc(LOGO_SRC)}" alt="${esc(MUNICIPALITY_NAME)}" />`;
}

function renderStatusBadge(status) {
  const tone = ({
    Borrador: 'neutral', 'En cotización': 'info', 'En evaluación': 'info', 'En visado': 'warning', 'Devuelta con observaciones': 'warning', Visada: 'success', Aprobada: 'success', Adjudicada: 'success', 'Contrato activo': 'purple', 'Contrato cerrado': 'neutral', Abortada: 'danger', Rechazada: 'danger', Activo: 'success', Inactiva: 'danger', Inactivo: 'danger', Pendiente: 'warning', Devuelta: 'warning', Vigente: 'success', Pagada: 'success', Cerrado: 'neutral',
  })[status] || 'neutral';
  return `<span class="status-badge status-${tone}">${esc(status)}</span>`;
}

function renderLedgerTag(status) { return `<span class="ledger-tag tag-${status.tone}">${esc(status.label)}</span>`; }

function renderPageHeader(eyebrow, title, description, actions = '') {
  return `<div class="page-header"><div class="page-header-copy"><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1>${description ? `<p>${esc(description)}</p>` : ''}</div><div class="page-actions">${actions}</div></div>`;
}

function renderLogin() {
  const cards = ROLES.map((role) => {
    const profile = ROLE_PROFILES[role];
    if (!isRoleActive(role)) return `<button type="button" class="role-card role-card-inactive" aria-disabled="true" data-blocked-reason="${esc(inactiveMessage(role))}" data-blocked-title="Acceso denegado" data-blocked-audit="intentó ingresar con un usuario inactivo (acceso denegado)" data-blocked-user="${esc(profile.name)}" data-blocked-role="${esc(role)}" data-blocked-object="Inicio de sesión"><span class="role-card-icon">${icon('user-x', 24)}</span><span class="role-card-copy"><strong>${esc(role)}</strong><span class="role-card-person">${esc(profile.name)} · ${esc(profile.department)}</span><span class="role-card-flag">Usuario inactivo: sin acceso al sistema</span></span><span class="role-card-go">${icon('ban', 20)}</span></button>`;
    return `<button type="button" class="role-card ${role === ROLE_SUPER ? 'role-card-top' : ''}" data-action="login-role" data-role="${esc(role)}"><span class="role-card-icon">${icon(profile.icon, 24)}</span><span class="role-card-copy"><strong>${esc(role)}</strong><span class="role-card-person">${esc(profile.name)} · ${esc(profile.department)}</span><span>${esc(roleSummary(role))}</span></span><span class="role-card-go">${icon('arrow-right', 20)}</span></button>`;
  }).join('');
  return `<div class="login-card"><div class="login-brand">${renderLogo('logo-login')}</div><div class="login-body"><p class="eyebrow">Sistema de gestión de compras</p><h1>Ingreso al prototipo</h1><p class="login-lead">Elija el perfil con el que desea ingresar. Puede cambiar de rol en cualquier momento desde la barra superior. Todos los datos son de ejemplo.</p><div class="role-grid">${cards}</div></div></div>`;
}

function renderShell() {
  const { route } = getRoute();
  const user = state.currentUser;
  const parent = { solicitud: 'solicitudes', proveedor: 'proveedores', 'fondos-insuficientes': 'aprobaciones' }[route] || route;
  const nav = [
    { group: 'Operación', items: [['dashboard', 'layout-dashboard', 'Inicio'], ['solicitudes', 'file-plus-2', user.role === 'Solicitante' ? 'Mis solicitudes' : 'Solicitudes'], ['mis-compras', 'shopping-bag', 'Mis compras'], ['cotizaciones', 'messages-square', 'Evaluación de cotizaciones'], ['aprobaciones', 'stamp', 'Visado', pendingForRole(user.role).length]] },
    { group: 'Control', items: [['contratos', 'file-signature', 'Contratos'], ['presupuesto', 'wallet-cards', 'Presupuesto'], ['renovacion-equipos', 'laptop', 'Renovación de equipos'], ['proveedores', 'building-2', 'Proveedores'], ['auditoria', 'scroll-text', 'Auditoría']] },
    { group: 'Administración', items: [['usuarios', 'users-round', 'Usuarios'], ['configuracion', 'sliders-horizontal', 'Configuración']] },
  ].map((group) => ({ ...group, items: group.items.filter(([value]) => canAccess(value)) })).filter((group) => group.items.length);

  document.querySelector('#sidebar').innerHTML = `<div class="brand"><div class="brand-logo">${renderLogo()}</div><div class="brand-subtitle">Gestión de compras · ${state.settings.currentYear}</div></div><div class="nav-scroll">${nav.map((group) => `<div class="nav-group"><div class="nav-label">${group.group}</div><div class="nav-list">${group.items.map(([value, ico, label, count]) => `<button type="button" class="nav-item ${parent === value ? 'active' : ''}" data-route="${value}" ${parent === value ? 'aria-current="page"' : ''}>${icon(ico, 20)}<span>${label}</span>${count ? `<span class="nav-count" aria-label="${count} pendientes">${count}</span>` : ''}</button>`).join('')}</div></div>`).join('')}</div><div class="sidebar-footer"><div class="user-mini"><div class="avatar">${esc(user.initials)}</div><div><strong>${esc(user.name)}</strong><span>${esc(user.role)}</span></div></div><button type="button" class="logout" data-action="logout">${icon('log-out', 16)}Cerrar sesión</button></div>`;

  document.querySelector('#topbar').innerHTML = `<div class="topbar-left"><button type="button" class="mobile-menu" data-action="toggle-sidebar" aria-label="Abrir navegación">${icon('menu', 24)}</button><span class="topbar-logo">${renderLogo('logo-topbar')}</span><span class="topbar-title">Sistema de gestión de compras</span></div><div class="topbar-right"><div class="role-switch"><label for="role-select">Rol activo</label><select id="role-select" data-role-select>${ROLES.map((role) => `<option value="${esc(role)}" ${role === user.role ? 'selected' : ''} ${isRoleActive(role) ? '' : 'disabled'}>${esc(role)}${isRoleActive(role) ? '' : ' (usuario inactivo)'}</option>`).join('')}</select></div><button type="button" class="icon-button" data-action="show-notifications" aria-label="Ver notificaciones">${icon('bell', 20)}<span class="notification-dot"></span></button><div class="topbar-user"><div class="avatar">${esc(user.initials)}</div><div class="topbar-user-meta"><strong>${esc(user.name)}</strong><span>${esc(user.department)}</span></div></div></div>`;

  const label = routeLabels[route] || (route === 'solicitud' ? 'Detalle de solicitud' : route === 'proveedor' ? 'Detalle de proveedor' : 'Vista');
  document.querySelector('#breadcrumb').innerHTML = `<span>${esc(MUNICIPALITY_NAME)}</span><span class="separator">/</span><strong>${esc(label)}</strong>`;
}

/* ===== Presupuesto: tarjetas y pantalla P-02 ===== */
function budgetSummary(account) {
  return `<div class="grid grid-3 account-cards"><article class="card account-card"><div class="account-label">Fondo asignado</div><div class="account-value amount">${formatCLP(account.asignado)}</div><div class="account-foot">Suma de las asignaciones del año ${account.year}.</div></article><article class="card account-card account-real"><div class="account-label">Saldo real ${renderLedgerTag(ledgerStatus('Ejecutado'))}</div><div class="account-value amount">${formatCLP(account.saldoReal)}</div><div class="account-foot">Fondo asignado menos lo ejecutado (${formatCLP(account.ejecutado)}).</div></article><article class="card account-card account-committed"><div class="account-label">Saldo comprometido ${renderLedgerTag(ledgerStatus('Aprobado'))}</div><div class="account-value amount">${formatCLP(account.saldoComprometido)}</div><div class="account-foot">Fondo asignado menos lo aprobado y devengado (${formatCLP(account.comprometido)}, neto de anulaciones).</div></article></div><p class="reconcile ${account.reconciles ? 'ok' : 'bad'}">${icon(account.reconciles ? 'circle-check' : 'triangle-alert', 18)}<span>${account.reconciles ? 'Los totales de las tarjetas coinciden con la suma de los movimientos del año.' : 'Atención: los totales no coinciden con los movimientos.'}</span></p>`;
}

function ledgerHint(line) {
  return ({
    'Asignación': line.amount >= 0 ? 'Aumenta ambos saldos' : 'Disminuye ambos saldos',
    Aprobado: 'Descuenta el saldo comprometido, una sola vez',
    Devengado: 'Sin nuevo descuento: ya estaba comprometido',
    Ejecutado: 'Descuenta el saldo real; no vuelve a descontar lo comprometido',
    Anulado: 'Devuelve el monto al saldo comprometido',
  })[line.type];
}

function renderDelta(value) {
  if (!value) return '<div class="delta delta-none">sin cambio</div>';
  return `<div class="delta ${value < 0 ? 'delta-down' : 'delta-up'}">${value < 0 ? '−' : '+'}${formatCLP(Math.abs(value))}</div>`;
}

function ledgerHeaders() { return '<th>Fecha</th><th>Solicitud</th><th>Proveedor</th><th>Responsable</th><th>Tipo y estado</th><th>Monto</th><th>Saldo real acumulado</th><th>Saldo comprometido acumulado</th>'; }

function renderLedgerRows(lines) {
  if (!lines.length) return `<tr><td colspan="8"><div class="empty-state">${icon('search-x', 28)}<strong>No hay movimientos con estos filtros</strong><span>Prueba limpiar los filtros o elegir otro año.</span></div></td></tr>`;
  return lines.map((line) => { const status = ledgerStatus(line.type); return `<tr><td class="no-wrap">${formatDate(line.date)}</td><td class="col-request">${line.request ? `<button type="button" class="table-link table-id" data-route="solicitud" data-id="${line.request.id}">${line.request.id}</button><div class="small">${esc(line.request.description)}</div>` : `<strong>${esc(line.description || 'Asignación')}</strong><div class="muted small">Movimiento de fondo</div>`}${line.request && line.description ? `<div class="muted small">${esc(line.description)}</div>` : ''}</td><td>${esc(line.providerName)}</td><td>${esc(line.responsible)}</td><td class="col-type"><strong>${esc(line.type)}</strong><div><span class="ledger-tag tag-${status.tone}" title="${esc(status.label)}">${esc(status.short)}</span></div></td><td class="amount" title="${esc(ledgerHint(line))}">${line.type === 'Asignación' && line.amount > 0 ? '+' : ''}${formatCLP(line.amount)}</td><td class="amount">${formatCLP(line.balanceReal)}${renderDelta(line.dReal)}</td><td class="amount">${formatCLP(line.balanceCommitted)}${renderDelta(line.dCommitted)}</td></tr>`; }).join('');
}

function renderAccount() {
  const filters = state.filters.cc || {};
  const year = Number(filters.year || state.settings.currentYear);
  const account = computeAccount(year);
  const years = [...new Set([...state.ledger.map((row) => row.year), state.settings.currentYear])].sort((a, b) => b - a);
  const options = (values) => [...new Set(values)].filter((value) => value && value !== '—').sort((a, b) => a.localeCompare(b, 'es'));
  const select = (key, id, label, values) => `<div class="filter-field"><label for="cc-${id}">${label}</label><select id="cc-${id}" data-filter-scope="cc" data-filter-key="${key}"><option value="">Todos</option>${values.map((value) => `<option value="${esc(value)}" ${filters[key] === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select></div>`;
  const shown = account.lines.filter((line) => (!filters.responsible || line.responsible === filters.responsible) && (!filters.department || line.department === filters.department) && (!filters.status || ledgerStatus(line.type).key === filters.status) && (!filters.provider || line.providerName === filters.provider) && (!filters.from || dateKey(line.date) >= filters.from) && (!filters.to || dateKey(line.date) <= filters.to)).reverse();
  const sumReal = shown.reduce((total, line) => total + line.dReal, 0);
  const sumCommitted = shown.reduce((total, line) => total + line.dCommitted, 0);
  const manage = can('manageFunds');
  const addButton = can('addFunds')
    ? `<button type="button" class="btn btn-secondary" data-action="open-budget-movement" data-type="Asignación">${icon('plus', 18)} Registrar asignación</button>`
    : blockedButton({ label: 'Registrar asignación', ico: 'plus', variant: 'btn-secondary', reason: ADD_FUNDS_MESSAGE, audit: 'intentó abonar presupuesto sin atribución (acción bloqueada)', object: 'Presupuesto' });
  const actions = addButton + (manage ? `<button type="button" class="btn btn-primary" data-action="open-budget-movement" data-type="Traspaso">${icon('arrow-right-left', 18)} Traspasar saldo</button>` : '');
  return `${renderPageHeader('P-02 · Control · presupuesto', 'Presupuesto', 'Una sola pantalla para lo real y lo comprometido: el fondo asignado, cada movimiento y los dos saldos acumulados.', actions)}${budgetSummary(account)}<section class="section-gap"><div class="filter-bar"><div class="filter-field"><label for="cc-year">Año</label><select id="cc-year" data-filter-scope="cc" data-filter-key="year">${years.map((value) => `<option value="${value}" ${value === year ? 'selected' : ''}>${value}</option>`).join('')}</select></div>${select('responsible', 'responsible', 'Responsable', options(account.lines.map((line) => line.responsible)))}${select('department', 'department', 'Departamento', options(account.lines.map((line) => line.department)))}<div class="filter-field"><label for="cc-status">Estado</label><select id="cc-status" data-filter-scope="cc" data-filter-key="status"><option value="">Todos</option>${LEDGER_STATUS_OPTIONS.map(([key, label]) => `<option value="${key}" ${filters.status === key ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></div>${select('provider', 'provider', 'Proveedor', options(account.lines.map((line) => line.providerName)))}<div class="filter-field"><label for="cc-from">Desde</label><input id="cc-from" type="date" data-filter-scope="cc" data-filter-key="from" value="${esc(filters.from || '')}" /></div><div class="filter-field"><label for="cc-to">Hasta</label><input id="cc-to" type="date" data-filter-scope="cc" data-filter-key="to" value="${esc(filters.to || '')}" /></div><button type="button" class="btn btn-secondary" data-action="clear-filters" data-scope="cc">${icon('rotate-ccw', 18)} Limpiar</button></div></section><section class="section-gap"><div class="section-heading"><div><h2>Movimientos de ${year}</h2><p class="muted">Más reciente primero. Los saldos acumulados muestran el presupuesto completo, aunque filtres la lista. Una aprobación descuenta el disponible una sola vez; devengar o ejecutar el pago no lo descuenta de nuevo.</p></div><span class="muted">${shown.length} de ${account.lines.length} movimientos</span></div><div class="card table-card"><div class="table-wrap"><table class="data-table ledger-table"><thead><tr>${ledgerHeaders()}</tr></thead><tbody>${renderLedgerRows(shown)}</tbody><tfoot><tr><td colspan="6">Suma del efecto de los movimientos mostrados</td><td class="amount">${formatCLP(sumReal)}</td><td class="amount">${formatCLP(sumCommitted)}</td></tr></tfoot></table></div></div></section>${manage ? `<div class="inline-actions section-gap"><button type="button" class="btn btn-secondary" data-action="open-budget-movement" data-type="Baja">Registrar baja</button><button type="button" class="btn btn-warning" data-action="open-budget-movement" data-type="Extinción">Extinguir presupuesto</button></div>` : ''}`;
}

/* ===== Alertas, tareas rápidas e inicio ===== */
function buildAlerts() {
  const alerts = [];
  pendingRequests().forEach((request) => {
    const tier = getTier(request.amount);
    alerts.push({ tone: 'warning', icon: 'stamp', title: `Compra pendiente de visado: ${tier.approverLabel}`, detail: `${request.id} · ${formatCLP(request.amount)}`, route: 'solicitud', id: request.id, tab: 'aprobaciones' });
    if (hasInsufficientFunds(request)) alerts.push({ tone: 'danger', icon: 'trending-down', title: 'Fondos insuficientes para visar esta compra', detail: `${request.id} · supera el saldo comprometido`, route: 'fondos-insuficientes', id: request.id });
  });
  state.requests.filter((request) => getTieInfo(request).isTie && !getTieInfo(request).resolved && !CLOSED_STATUSES.includes(request.status)).forEach((request) => alerts.push({ tone: 'danger', icon: 'scale', title: 'Empate de puntaje: decide el aprobador', detail: `${request.id} · ${request.description}`, route: 'solicitud', id: request.id, tab: 'cotizaciones' }));
  state.requests.filter((request) => request.status === 'Devuelta con observaciones').forEach((request) => alerts.push({ tone: 'info', icon: 'message-square-warning', title: 'Solicitud devuelta con observaciones', detail: `${request.id} · ${request.observations || 'Revisar antecedentes'}`, route: 'solicitud', id: request.id }));
  state.contracts.filter((contract) => contract.status === 'Activo').forEach((contract) => alerts.push({ tone: 'success', icon: 'file-clock', title: 'Contrato pendiente de cierre', detail: `${contract.id} · ${getRequest(contract.requestId)?.description || ''}`, route: 'contratos' }));
  return alerts.filter((alert) => canAccess(alert.route));
}

function renderQuickTasks() {
  const role = state.currentUser.role;
  const pendingCount = pendingForRole(role).length;
  const all = {
    nueva: ['plus', 'Nueva solicitud', 'Registrar una necesidad de compra', 'data-action="open-new-request"'],
    solicitudes: ['file-plus-2', role === 'Solicitante' ? 'Mis solicitudes' : 'Solicitudes', 'Buscar y revisar solicitudes', 'data-route="solicitudes"'],
    compras: ['shopping-bag', 'Mis compras', 'Transacciones bajo tu responsabilidad', 'data-route="mis-compras"'],
    cotizaciones: ['messages-square', 'Evaluar cotizaciones', 'Puntajes y desempates', 'data-route="cotizaciones"'],
    aprobaciones: ['stamp', 'Visado', `${pendingCount} pendiente${pendingCount === 1 ? '' : 's'} para tu rol`, 'data-route="aprobaciones"'],
    cuenta: ['wallet-cards', 'Presupuesto', 'Saldo real y comprometido', 'data-route="presupuesto"'],
    contratos: ['file-signature', 'Contratos', 'Contratos activos y cerrados', 'data-route="contratos"'],
    usuarios: ['users-round', 'Usuarios', 'Roles y accesos', 'data-route="usuarios"'],
    config: ['sliders-horizontal', 'Configuración', 'Tramos de visado y año', 'data-route="configuracion"'],
    auditoria: ['scroll-text', 'Auditoría', 'Historial de decisiones', 'data-route="auditoria"'],
    equipos: ['laptop', 'Renovación de equipos', 'Equipos con 3 años cumplidos', 'data-route="renovacion-equipos"'],
  };
  const byRole = {
    Solicitante: ['nueva', 'solicitudes'],
    Comprador: ['nueva', 'compras', 'cotizaciones', 'cuenta'],
    Supervisor: ['aprobaciones', 'cotizaciones', 'cuenta', 'solicitudes'],
    Jefatura: ['aprobaciones', 'cotizaciones', 'cuenta', 'auditoria'],
    [ROLE_SUPER]: ['aprobaciones', 'cotizaciones', 'cuenta', 'auditoria'],
    'Administrador técnico': ['usuarios', 'config', 'auditoria', 'contratos'],
    [READ_ONLY_ROLE]: ['solicitudes', 'equipos'],
  }[role];
  return `<section class="section-gap"><div class="section-heading"><div><h2>Tareas principales</h2><p class="muted">Cada tarea está a un clic de distancia.</p></div></div><div class="task-grid">${byRole.map((key) => { const [ico, title, copy, attrs] = all[key]; return `<button type="button" class="task-card" ${attrs}><span class="task-icon">${icon(ico, 26)}</span><span class="task-copy"><strong>${esc(title)}</strong><span>${esc(copy)}</span></span></button>`; }).join('')}</div></section>`;
}

function renderStat(label, value, detail, ico, tone = '') {
  return `<article class="card stat-card"><div class="stat-top"><span>${esc(label)}</span><span class="stat-icon">${icon(ico, 22)}</span></div><div class="stat-value">${esc(value)}</div><div class="stat-foot ${tone}">${esc(detail)}</div></article>`;
}

function requestMatches(request, filters = {}) {
  const search = String(filters.search || '').toLowerCase();
  if (search && ![request.id, request.description, request.department, request.requester, request.buyer].join(' ').toLowerCase().includes(search)) return false;
  if (filters.status && request.status !== filters.status) return false;
  if (filters.department && request.department !== filters.department) return false;
  if (filters.buyer && request.buyer !== filters.buyer) return false;
  if (filters.year && String(request.year) !== String(filters.year)) return false;
  return true;
}

function renderRequestRows(requests, options = {}) {
  if (!requests.length) return `<tr><td colspan="${options.compact ? 5 : 8}"><div class="empty-state">${icon('search-x', 28)}<strong>No encontramos solicitudes</strong><span>Prueba cambiar los filtros o crea una nueva solicitud.</span></div></td></tr>`;
  return requests.map((request) => `<tr><td><button type="button" class="table-link table-id" data-route="solicitud" data-id="${request.id}">${request.id}</button></td>${options.compact ? `<td>${esc(request.department)}</td>` : ''}<td><strong>${esc(request.description)}</strong><div class="muted small">${options.compact ? '' : `${esc(request.department)} · `}${request.quantity} unidad${request.quantity === 1 ? '' : 'es'}</div></td>${options.compact ? '' : `<td class="amount">${formatCLP(request.amount)}</td><td class="no-wrap">${formatDate(request.requiredDate)}</td><td>${esc(request.requester)}</td><td>${esc(request.buyer)}</td>`}<td>${renderStatusBadge(request.status)}</td>${options.compact ? `<td class="amount">${formatCLP(request.amount)}</td>` : `<td class="actions"><button type="button" class="btn btn-ghost btn-sm" data-route="solicitud" data-id="${request.id}">Ver detalle ${icon('arrow-up-right', 16)}</button></td>`}</tr>`).join('');
}

function requestTable(requests, compact = false) {
  const headers = compact ? '<th>ID</th><th>Departamento</th><th>Descripción</th><th>Estado</th><th>Monto</th>' : '<th>ID</th><th>Descripción y departamento</th><th>Monto estimado</th><th>Fecha requerida</th><th>Solicitante</th><th>Comprador</th><th>Estado</th><th>Acciones</th>';
  return `<div class="card table-card"><div class="table-wrap"><table class="data-table"><thead><tr>${headers}</tr></thead><tbody>${renderRequestRows(requests, { compact })}</tbody></table></div></div>`;
}

function renderDashboard() {
  const account = computeAccount(state.settings.currentYear);
  const mine = visibleRequests();
  const active = mine.filter((request) => !CLOSED_STATUSES.includes(request.status)).length;
  const pending = mine.filter((request) => request.status === 'En visado').length;
  const awarded = mine.filter((request) => ['Adjudicada', 'Contrato activo', 'Contrato cerrado'].includes(request.status)).length;
  const myIds = new Set(mine.map((request) => request.id));
  const openContracts = state.contracts.filter((contract) => contract.status === 'Activo' && myIds.has(contract.requestId)).length;
  const closedContracts = state.contracts.filter((contract) => contract.status === 'Cerrado' && myIds.has(contract.requestId)).length;
  const filters = state.filters.dashboard || {};
  const filtered = mine.filter((request) => requestMatches(request, filters));
  const departments = [...new Set(mine.map((request) => request.department))];
  const buyers = [...new Set(mine.map((request) => request.buyer))];
  const statuses = [...new Set(mine.map((request) => request.status))];
  const alerts = buildAlerts();
  const showAccount = canAccess('presupuesto');
  const field = (id, label, key, values) => `<div class="filter-field"><label for="dashboard-${id}">${label}</label><select id="dashboard-${id}" data-filter-scope="dashboard" data-filter-key="${key}"><option value="">Todos</option>${values.map((value) => `<option ${filters[key] === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select></div>`;
  return `${renderPageHeader('Centro de control', 'Inicio', `Bienvenido, ${state.currentUser.name}. Esta es la lectura del flujo de compras para tu rol (${state.currentUser.role}).`, newRequestButton())}${renderQuickTasks()}<section class="section-gap"><div class="grid grid-5">${renderStat('Solicitudes activas', active, 'En curso', 'file-clock', 'positive')}${renderStat('Pendientes de visado', pending, `Para tu rol: ${pendingForRole(state.currentUser.role).length}`, 'stamp', 'warning')}${renderStat('Compras adjudicadas', awarded, 'En curso y cerradas', 'badge-check', 'positive')}${renderStat('Contratos abiertos', openContracts, 'Con seguimiento activo', 'file-signature', '')}${renderStat('Contratos cerrados', closedContracts, 'Solo lectura', 'archive', '')}</div></section>${showAccount ? `<section class="section-gap"><div class="section-heading"><div><h2>Presupuesto ${state.settings.currentYear}</h2><p class="muted">Fondo, saldo real y saldo comprometido de la municipalidad.</p></div><button class="btn btn-secondary" type="button" data-route="presupuesto">Ver movimientos ${icon('arrow-right', 18)}</button></div>${budgetSummary(account)}</section>` : ''}<section class="section-gap"><div class="section-heading"><div><h2>Transacciones recientes</h2><p class="muted">Filtra la actividad para encontrar una compra en segundos</p></div><span class="muted">${filtered.length} resultados</span></div><div class="filter-bar"><div class="filter-field search-field"><label for="dashboard-search">Buscar</label><input id="dashboard-search" data-filter-scope="dashboard" data-filter-key="search" value="${esc(filters.search || '')}" placeholder="ID, descripción, departamento o comprador" /></div>${field('department', 'Departamento', 'department', departments)}${field('buyer', 'Comprador', 'buyer', buyers)}${field('status', 'Estado', 'status', statuses)}<button type="button" class="btn btn-secondary" data-action="clear-dashboard-filters">${icon('rotate-ccw', 18)} Limpiar</button></div><div class="section-gap">${requestTable(filtered.slice(0, 6), true)}</div></section><section class="section-gap"><div class="section-heading"><div><h2>Alertas</h2><p class="muted">Situaciones que requieren seguimiento</p></div></div><div class="alert-list">${alerts.length ? alerts.map((alert) => `<div class="alert-item"><div class="alert-icon ${alert.tone}">${icon(alert.icon, 22)}</div><div class="alert-copy"><strong>${esc(alert.title)}</strong><span>${esc(alert.detail)}</span></div><button type="button" class="btn btn-ghost btn-sm" data-route="${alert.route}" ${alert.id ? `data-id="${alert.id}"` : ''} ${alert.tab ? `data-tab="${alert.tab}"` : ''}>Revisar ${icon('arrow-up-right', 16)}</button></div>`).join('') : '<div class="alert-item"><div class="alert-copy"><strong>No hay alertas para tu rol.</strong></div></div>'}</div></section>`;
}

function renderRequestFilters(scope = 'requests') {
  const filters = state.filters[scope] || {};
  const base = visibleRequests();
  const field = (key, label, values) => `<div class="filter-field"><label for="${scope}-${key}">${label}</label><select id="${scope}-${key}" data-filter-scope="${scope}" data-filter-key="${key}"><option value="">Todos</option>${values.map((value) => `<option ${filters[key] === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select></div>`;
  return `<div class="filter-bar"><div class="filter-field search-field"><label for="${scope}-search">Buscar solicitud</label><input id="${scope}-search" data-filter-scope="${scope}" data-filter-key="search" value="${esc(filters.search || '')}" placeholder="ID, descripción o solicitante" /></div>${field('status', 'Estado', [...new Set(base.map((request) => request.status))])}${field('department', 'Departamento', [...new Set(base.map((request) => request.department))])}${field('buyer', 'Comprador', [...new Set(base.map((request) => request.buyer))])}<button type="button" class="btn btn-secondary" data-action="clear-filters" data-scope="${scope}">${icon('rotate-ccw', 18)} Limpiar</button></div>`;
}

function renderRequests(scope = 'requests', mode = 'all') {
  const filters = state.filters[scope] || {};
  let requests = visibleRequests().filter((request) => requestMatches(request, filters));
  if (mode === 'mine') requests = requests.filter((request) => request.buyer === state.currentUser.name);
  const requester = state.currentUser.role === 'Solicitante';
  const title = mode === 'mine' ? 'Mis compras' : requester ? 'Mis solicitudes' : 'Solicitudes de compra';
  const copy = mode === 'mine' ? 'Las transacciones actualmente bajo tu responsabilidad.' : requester ? 'Las solicitudes que has creado y su estado actual.' : 'Centraliza solicitudes que antes llegaban por correo y planillas.';
  return `${renderPageHeader(mode === 'mine' ? 'Operación · titularidad' : 'Operación · entrada', title, copy, mode !== 'mine' ? newRequestButton() : '')}${renderRequestFilters(scope)}<section class="section-gap">${requestTable(requests)}</section>`;
}

/* ===== P-05: evaluación de cotizaciones y empate ===== */
function awardState(request) {
  const tie = getTieInfo(request);
  const enoughQuotes = request.directDeal ? getQuotes(request.id).length >= 1 : getQuotes(request.id).length >= 3;
  if (!can('award') || request.status !== 'Visada') return { visible: false };
  if (!enoughQuotes) return { visible: true, enabled: false, reason: 'Faltan cotizaciones para poder adjudicar.' };
  if (!tie.resolved) return { visible: true, enabled: false, reason: 'Bloqueado: hay un empate de puntaje que debe resolver el aprobador.' };
  return { visible: true, enabled: true, reason: '' };
}

function renderAwardButton(request, small = false) {
  const award = awardState(request);
  if (!award.visible) return '';
  return `<button type="button" class="btn btn-primary ${small ? 'btn-sm' : ''}" data-action="open-award-form" data-id="${request.id}" ${award.enabled ? '' : `disabled aria-disabled="true" title="${esc(award.reason)}"`}>${icon('badge-check', 18)} Adjudicar</button>`;
}

function renderTiePanel(request, tie) {
  const tier = getTier(request.amount);
  const names = tie.tied.map((quote) => esc(quote.provider?.name || 'Proveedor')).join(' y ');
  if (tie.decision) {
    const chosen = tie.tied.find((quote) => quote.id === tie.decision.quoteId);
    return `<div class="callout success section-gap" role="status">${icon('circle-check', 20)}<span><strong>Empate resuelto por el aprobador.</strong> Eligió a ${esc(chosen?.provider?.name || 'el proveedor')} (${esc(tie.decision.role)}: ${esc(tie.decision.by)}, ${formatDateTime(tie.decision.at)}).<br /><em>Justificación:</em> ${esc(tie.decision.note)}</span></div>`;
  }
  const allowed = canVisar(state.currentUser.role, request.amount);
  const alert = `<div class="callout danger tie-alert section-gap" role="alert">${icon('scale', 22)}<span><strong>Empate de puntaje: decide el aprobador</strong><br />${names} obtuvieron ${formatScore(tie.tied[0].score)} puntos. Debe decidir ${esc(tier.approverLabel)} (${tierRangeText(tier).toLowerCase()}), elegir una cotización y escribir una justificación. Mientras tanto, <strong>Adjudicar permanece bloqueado</strong>.</span></div>`;
  if (!allowed) return `${alert}<div class="callout warning">${icon('lock', 20)}<span>Tu rol (${esc(state.currentUser.role)}) no puede decidir este empate. ${esc(tier.blockMessage)}.</span></div>`;
  return `${alert}<form class="card card-pad tie-panel" data-form="tie-break" data-request-id="${request.id}"><h3>Decisión de desempate</h3><fieldset class="tie-options"><legend class="field-label">Elige la cotización ganadora *</legend>${tie.tied.map((quote, index) => `<label class="tie-option"><input type="radio" name="quoteId" value="${quote.id}" ${index === 0 ? 'required' : ''} /><span><strong>${esc(quote.provider?.name || 'Proveedor')}</strong><span class="muted"> · ${formatCLP(quote.price)} · ${formatScore(quote.score)} puntos</span></span></label>`).join('')}</fieldset><label for="tie-note">Justificación (obligatoria) *</label><textarea id="tie-note" name="note" required data-min-chars="${MIN_NOTE_CHARS}" placeholder="Explica por qué esta cotización es la más conveniente para la municipalidad."></textarea><div class="field-hint">La decisión queda registrada en el historial con tu nombre, rol y fecha.</div><div class="page-actions" style="margin-top:16px;justify-content:flex-start"><button type="submit" class="btn btn-primary">${icon('gavel', 18)} Registrar decisión de desempate</button></div></form>`;
}

function renderQuoteTable(request) {
  const tie = getTieInfo(request);
  const quotes = tie.scored;
  const tiedIds = new Set(tie.isTie ? tie.tied.map((quote) => quote.id) : []);
  const canSelect = can('quote') && !['Adjudicada', 'Contrato activo', 'Contrato cerrado', 'Abortada', 'Rechazada'].includes(request.status);
  const result = (quote, index) => {
    if (tie.decision && tie.decision.quoteId === quote.id) return '<span class="status-badge status-success">Elegida en desempate</span>';
    if (tiedIds.has(quote.id)) return '<span class="status-badge status-danger">Empate en 1.er lugar</span>';
    if (request.selectedQuoteId === quote.id) return '<span class="status-badge status-info">Seleccionada</span>';
    return index === 0 && !tie.isTie ? '<span class="status-badge status-success">Mejor puntaje</span>' : '<span class="status-badge status-neutral">Evaluada</span>';
  };
  const award = renderAwardButton(request);
  const awardNote = awardState(request).visible ? (awardState(request).enabled ? 'Se registrarán comprador, puntaje, fecha y criterio.' : awardState(request).reason) : (can('award') ? 'Se podrá adjudicar cuando la compra esté visada (estado Visada).' : '');
  return `<div class="section-heading"><div><p class="eyebrow">P-05 · Evaluación</p><h2>Cotizaciones recibidas</h2><p class="muted">Los puntajes (1 a 7) los ingresa el comprador; el sistema calcula el ponderado: 50% valor económico, 25% calidad técnica, 25% entrega.</p></div>${can('quote') && ['Borrador', 'En cotización', 'En evaluación', 'Devuelta con observaciones'].includes(request.status) ? `<button type="button" class="btn btn-secondary" data-action="open-quote-form" data-id="${request.id}">${icon('plus', 18)} Agregar cotización</button>` : ''}</div>${!request.directDeal && quotes.length < 3 ? `<div class="callout warning section-gap">${icon('triangle-alert', 20)}<span>Se requieren al menos 3 cotizaciones para continuar con una compra normal.</span></div>` : ''}${tie.isTie ? renderTiePanel(request, tie) : ''}<div class="card table-card section-gap"><div class="table-wrap"><table class="data-table"><thead><tr><th>Proveedor</th><th>Valor oferta</th><th>Valor económico (50%)</th><th>Calidad técnica (25%)</th><th>Entrega (25%)</th><th>Puntaje ponderado</th><th>Resultado</th><th></th></tr></thead><tbody>${quotes.length ? quotes.map((quote, index) => `<tr class="${tiedIds.has(quote.id) ? 'row-tie' : ''}"><td><strong>${esc(quote.provider?.name || 'Proveedor')}</strong><div class="muted small">${esc(quote.provider?.rut || '')}</div></td><td class="amount">${formatCLP(quote.price)}</td><td>${quote.economic}/7</td><td>${quote.technical}/7</td><td>${quote.delivery}/7</td><td><strong class="mono">${formatScore(quote.score)}</strong></td><td>${result(quote, index)}</td><td>${canSelect ? `<button type="button" class="btn btn-ghost btn-sm" data-action="select-quote" data-id="${request.id}" data-quote-id="${quote.id}" ${tie.isTie && !tie.resolved ? 'disabled aria-disabled="true" title="Primero debe resolverse el empate"' : ''}>Seleccionar</button>` : ''}</td></tr>`).join('') : `<tr><td colspan="8"><div class="empty-state">${icon('messages-square', 28)}<strong>Aún no hay cotizaciones</strong><span>Agrega la primera cotización para iniciar la evaluación.</span></div></td></tr>`}</tbody></table></div></div>${quotes.length && (award || awardNote) ? `<div class="inline-actions section-gap">${award}<span class="muted">${esc(awardNote)}</span></div>` : ''}`;
}

function renderQuoteIndex() {
  const quoteRequests = visibleRequests().filter((request) => getQuotes(request.id).length);
  return `${renderPageHeader('Operación · P-05 · evaluación', 'Evaluación de cotizaciones', 'Revisa las cotizaciones por solicitud, el puntaje ponderado y los empates que esperan decisión del aprobador.', '')}<div class="grid grid-3">${quoteRequests.map((request) => { const tie = getTieInfo(request); return `<article class="card card-pad"><div class="split"><span class="table-id mono">${request.id}</span>${renderStatusBadge(request.status)}</div><h3 style="margin-top:13px">${esc(request.description)}</h3><p class="muted">${getQuotes(request.id).length} cotización${getQuotes(request.id).length === 1 ? '' : 'es'} · ${formatCLP(request.amount)}</p>${tie.isTie ? `<p>${tie.resolved ? '<span class="status-badge status-success">Empate resuelto</span>' : '<span class="status-badge status-danger">Empate de puntaje: decide el aprobador</span>'}</p>` : ''}<button type="button" class="btn btn-secondary btn-sm" data-route="solicitud" data-id="${request.id}" data-tab="cotizaciones">Abrir evaluación ${icon('arrow-right', 16)}</button></article>`; }).join('')}</div>`;
}

/* ===== Detalle de solicitud ===== */
function renderProcessStepper(request) {
  const ended = ['Abortada', 'Rechazada'].includes(request.status);
  let index = processSteps.findIndex((step) => step[1] === request.status);
  if (request.status === 'Devuelta con observaciones') index = 2;
  if (ended) index = -1;
  return `<div class="process-wrap"><div class="section-heading"><div><h3>Recorrido del proceso</h3><p class="muted">La transacción conserva cada etapa y sus decisiones.</p></div>${ended || request.status === 'Devuelta con observaciones' ? renderStatusBadge(request.status) : ''}</div><div class="process-track">${processSteps.map(([short], stepIndex) => { const complete = index >= stepIndex && !ended; const current = index === stepIndex && request.status !== 'Contrato cerrado'; return `<div class="process-step ${complete ? 'complete' : ''} ${current ? 'current' : ''} ${ended ? 'blocked' : ''}"><div class="process-dot">${complete ? icon('check', 14) : ended ? icon('x', 14) : stepIndex + 1}</div><div class="process-label">${esc(short)}</div></div>`; }).join('')}</div></div>`;
}

function renderOwnership(request) {
  return `<div class="ownership-card"><div class="section-heading"><div><h3>Titularidad</h3><p class="muted">Quién responde por esta compra</p></div>${icon('users-round', 22)}</div><div class="ownership-line"><span>Comprador actual</span><strong>${esc(request.buyer)}</strong></div><div class="ownership-line"><span>Titular original</span><strong>${esc(request.ownerOriginal || request.buyer)}</strong></div>${request.status === 'Contrato cerrado' ? '<p class="muted small" style="margin:12px 0 0">Contrato cerrado: la titularidad no se puede cambiar.</p>' : `<div class="inline-actions" style="margin-top:12px">${can('delegate') ? `<button type="button" class="btn btn-secondary btn-sm" data-action="open-delegate" data-id="${request.id}">${icon('send', 16)} Delegar</button>` : ''}${can('reassign') ? `<button type="button" class="btn btn-ghost btn-sm" data-action="open-reassign" data-id="${request.id}">Reasignar</button><button type="button" class="btn btn-ghost btn-sm" data-action="open-take-control" data-id="${request.id}">Tomar control</button>` : ''}</div>`}</div>`;
}

/* ===== Botones bloqueados por rol ===== */
// Un botón bloqueado se ve deshabilitado (aria-disabled), no ejecuta la acción y, al intentarlo, explica el motivo.
function blockedButton({ label, ico, variant = 'btn-secondary', cls = '', reason, audit = '', id = '', object = '' }) {
  return `<button type="button" class="btn ${variant} ${cls} btn-blocked" aria-disabled="true" data-blocked-reason="${esc(reason)}" data-blocked-audit="${esc(audit)}" data-blocked-object="${esc(object)}" ${id ? `data-id="${id}"` : ''}>${icon(ico, 18)} ${esc(label)}</button>`;
}
const shortReason = (message) => message.replace(/^Esta compra requiere/, 'Requiere');
function renderReasons(reasons) {
  const unique = [...new Set(reasons.filter(Boolean))];
  return unique.length ? `<p class="action-reason">${icon('lock', 18)}<span>${unique.map(esc).join(' · ')}</span></p>` : '';
}

function newRequestButton() {
  if (can('createRequest')) return `<button type="button" class="btn btn-primary" data-action="open-new-request">${icon('plus', 18)} Nueva solicitud</button>`;
  if (isReadOnly()) return blockedButton({ label: 'Nueva solicitud', ico: 'plus', variant: 'btn-primary', reason: READ_ONLY_MESSAGE, audit: 'intentó crear una solicitud con rol de solo lectura (acción bloqueada)' });
  return '';
}

// Aprobar / Devolver / Rechazar: si el rol no puede visar esta compra, los botones quedan bloqueados y se explica el motivo.
function renderVisadoButtons(request, { small = true, only = null } = {}) {
  if (request.status !== 'En visado') return { html: '', reason: '' };
  const role = state.currentUser.role;
  const readOnly = isReadOnly(role);
  if (!readOnly && roleRank(role) === 0) return { html: '', reason: '' };
  const tier = getTier(request.amount);
  const allowed = !readOnly && canVisar(role, request.amount);
  const reason = readOnly ? READ_ONLY_MESSAGE : tier.blockMessage;
  const defs = [['approve-request', 'check', 'Aprobar', 'btn-success', 'aprobar'], ['open-return', 'corner-down-left', 'Devolver', 'btn-warning', 'devolver'], ['open-reject', 'circle-x', 'Rechazar', 'btn-danger', 'rechazar']].filter(([action]) => !only || only.includes(action));
  const html = defs.map(([action, ico, label, variant, verb]) => (allowed
    ? `<button type="button" class="btn ${variant} ${small ? 'btn-sm' : ''}" data-action="${action}" data-id="${request.id}">${icon(ico, 18)} ${label}</button>`
    : blockedButton({ label, ico, variant, cls: small ? 'btn-sm' : '', reason, audit: `intentó ${verb} sin atribución (acción bloqueada)`, id: request.id }))).join('');
  return { html, reason: allowed ? '' : (readOnly ? READ_ONLY_MESSAGE : shortReason(tier.blockMessage)) };
}

function renderRequestActions(request) {
  const quotes = getQuotes(request.id);
  const role = state.currentUser.role;
  const status = request.status;
  const readOnly = isReadOnly(role);
  const enoughQuotes = request.directDeal ? quotes.length >= 1 : quotes.length >= 3;
  const contract = getContract(request.id);
  const actions = [];
  const reasons = [];
  const roBlocked = (label, ico, variant, verb) => { reasons.push(READ_ONLY_MESSAGE); return blockedButton({ label, ico, variant, cls: 'btn-sm', reason: READ_ONLY_MESSAGE, audit: `intentó ${verb} con rol de solo lectura (acción bloqueada)`, id: request.id }); };
  if (['Borrador', 'En cotización', 'En evaluación', 'Devuelta con observaciones'].includes(status)) {
    if (can('quote')) actions.push(`<button type="button" class="btn btn-secondary btn-sm" data-action="open-quote-form" data-id="${request.id}">${icon('messages-square', 18)} Registrar cotización</button>`);
    else if (readOnly) actions.push(roBlocked('Registrar cotización', 'messages-square', 'btn-secondary', 'registrar una cotización'));
  }
  if (['En evaluación', 'Devuelta con observaciones', 'Borrador', 'En cotización'].includes(status) && enoughQuotes) {
    if (can('requestApproval')) actions.push(`<button type="button" class="btn btn-primary btn-sm" data-action="request-approval" data-id="${request.id}">${icon('stamp', 18)} Solicitar visado (${esc(getTier(request.amount).approverLabel)})</button>`);
    else if (readOnly) actions.push(roBlocked('Solicitar visado', 'stamp', 'btn-primary', 'solicitar un visado'));
  }
  const visado = renderVisadoButtons(request);
  if (visado.html) { actions.push(visado.html); reasons.push(visado.reason); }
  actions.push(renderAwardButton(request, true));
  if (status === 'Adjudicada' && contract?.status === 'Activo') {
    if (can('closeContract')) {
      actions.push(`<button type="button" class="btn btn-secondary btn-sm" data-action="open-attach-contract" data-id="${request.id}">${icon('paperclip', 18)} ${contract.signedDoc ? 'Reemplazar contrato adjunto' : 'Adjuntar contrato'}</button>`);
      if (contract.signedDoc) {
        actions.push(`<span class="attached-doc">${icon('file-check', 18)} ${esc(contract.signedDoc.name)}</span>`);
        actions.push(`<button type="button" class="btn btn-primary btn-sm" data-action="close-contract" data-id="${request.id}">${icon('lock-keyhole', 18)} Cerrar contrato</button>`);
      } else {
        actions.push(blockedButton({ label: 'Cerrar contrato', ico: 'lock-keyhole', variant: 'btn-primary', cls: 'btn-sm', reason: CONTRACT_ATTACH_MESSAGE, audit: 'intentó cerrar el contrato sin adjuntar el contrato firmado y timbrado (acción bloqueada)', id: request.id }));
        reasons.push(CONTRACT_ATTACH_MESSAGE);
      }
    } else if (readOnly) actions.push(roBlocked('Cerrar contrato', 'lock-keyhole', 'btn-primary', 'cerrar un contrato'));
  }
  if (can('executePayment') && status === 'Contrato cerrado' && contract && contract.devengo && !contract.paid) actions.push(`<button type="button" class="btn btn-success btn-sm" data-action="execute-payment" data-id="${request.id}">${icon('circle-dollar-sign', 18)} Marcar pago ejecutado</button>`);
  if (can('overdraft') && PRE_APPROVAL_STATUSES.includes(status) && hasInsufficientFunds(request)) actions.push(`<button type="button" class="btn btn-warning btn-sm" data-action="open-overdraft" data-id="${request.id}">${icon('trending-down', 18)} Solicitar autorización de sobregiro</button>`);
  return actions.join('') + renderReasons(reasons);
}

function renderRequestDetail(requestId) {
  const request = getRequest(requestId) || visibleRequests()[0] || state.requests[0];
  state.selectedRequestId = request.id;
  const route = getRoute();
  const tab = route.tab || state.detailTabs[request.id] || 'resumen';
  const contract = getContract(request.id);
  const tier = getTier(request.amount);
  const account = computeAccount(request.year);
  const lacksFunds = PRE_APPROVAL_STATUSES.includes(request.status) && hasInsufficientFunds(request);
  const tie = getTieInfo(request);
  const body = tab === 'cotizaciones' ? renderQuoteTable(request) : tab === 'aprobaciones' ? renderApprovalDetail(request) : tab === 'documentos' ? renderDocuments(request.id) : tab === 'presupuesto' ? renderRequestBudget(request) : tab === 'historial' ? renderRequestHistory(request.id) : renderRequestSummary(request, contract);
  const tabs = [['resumen', 'Resumen'], ['cotizaciones', 'Cotizaciones'], ['aprobaciones', 'Visado'], ['documentos', 'Documentos'], ['presupuesto', 'Presupuesto'], ['historial', 'Historial']];
  return `<div class="page-header"><div class="page-header-copy"><p class="eyebrow">Solicitud / transacción</p><h1>${esc(request.id)}</h1><p>${esc(request.description)} · ${esc(request.department)}</p></div><div class="page-actions"><button type="button" class="btn btn-secondary" data-route="${state.currentUser.role === 'Solicitante' ? 'solicitudes' : 'solicitudes'}">${icon('arrow-left', 18)} Volver a solicitudes</button></div></div><section class="detail-header"><div class="split"><div><p class="eyebrow">Compra municipal</p><h2 class="detail-title">${esc(request.description)}</h2><p>${esc(request.department)} · Solicitante ${esc(request.requester)}</p></div><div class="inline-actions">${request.directDeal ? '<span class="status-badge status-purple">Trato directo</span>' : ''}${CLOSED_STATUSES.includes(request.status) ? '' : `<span class="status-badge status-info">Visado: ${esc(tier.approverLabel)}</span>`}${renderStatusBadge(request.status)}</div></div><div class="detail-meta-grid"><div class="detail-meta"><label>Comprador responsable</label><strong>${esc(request.buyer)}</strong></div><div class="detail-meta"><label>Titular original</label><strong>${esc(request.ownerOriginal || request.buyer)}</strong></div><div class="detail-meta"><label>Monto estimado</label><strong class="amount">${formatCLP(request.amount)}</strong></div><div class="detail-meta"><label>Año presupuestario</label><strong>${request.year}</strong></div><div class="detail-meta"><label>Fecha requerida</label><strong>${formatDate(request.requiredDate)}</strong></div></div></section><section class="card card-pad section-gap"><div class="section-heading"><div><h3>Acciones disponibles para tu rol (${esc(state.currentUser.role)})</h3></div></div><div class="inline-actions">${renderRequestActions(request) || '<span class="muted">No hay acciones pendientes para esta etapa.</span>'}</div></section><section class="section-gap">${renderProcessStepper(request)}</section>${request.status === 'Devuelta con observaciones' ? `<div class="callout warning section-gap">${icon('message-square-warning', 20)}<span><strong>Devuelta con observaciones.</strong> ${esc(request.observations || 'Revisar antecedentes antes de reenviar.')}</span></div>` : ''}${request.status === 'Rechazada' ? `<div class="callout danger section-gap">${icon('circle-x', 20)}<span><strong>Compra rechazada.</strong> ${esc(request.observations)}</span></div>` : ''}${lacksFunds ? `<div class="callout danger section-gap">${icon('trending-down', 20)}<span><strong>Esta compra excede el saldo comprometido en ${formatCLP(request.amount - account.saldoComprometido)}.</strong> No podrá visarse sin una autorización de sobregiro. <button type="button" class="table-link" data-route="fondos-insuficientes" data-id="${request.id}">Ver detalle de fondos (P-12)</button></span></div>` : ''}${tie.isTie && !tie.resolved && request.status !== 'Adjudicada' ? `<div class="callout danger section-gap">${icon('scale', 20)}<span><strong>Empate de puntaje: decide el aprobador.</strong> <button type="button" class="table-link" data-action="change-detail-tab" data-id="${request.id}" data-tab="cotizaciones">Ir a la evaluación (P-05)</button></span></div>` : ''}<section class="card section-gap"><nav class="tab-bar" aria-label="Secciones de solicitud">${tabs.map(([value, label]) => `<button type="button" class="tab-button ${tab === value ? 'active' : ''}" data-action="change-detail-tab" data-id="${request.id}" data-tab="${value}">${label}${value === 'documentos' ? ` <span class="muted">${state.documents.filter((doc) => doc.requestId === request.id).length}</span>` : ''}</button>`).join('')}</nav><div class="card-pad">${body}</div></section>`;
}

function renderRequestSummary(request, contract) {
  const tier = getTier(request.amount);
  return `<div class="grid grid-2"><div><div class="section-heading"><div><h2>Resumen de la compra</h2><p class="muted">El contexto necesario para decidir el siguiente paso.</p></div></div><div class="grid grid-2"><div><div class="kicker">Descripción</div><strong>${esc(request.description)}</strong></div><div><div class="kicker">Cantidad</div><strong>${formatNumber(request.quantity)}</strong></div><div><div class="kicker">Fecha de creación</div><strong>${formatDateTime(request.createdAt)}</strong></div><div><div class="kicker">Contrato vinculado</div><strong>${contract ? contract.id : 'Se genera al adjudicar'}</strong></div><div><div class="kicker">Visado requerido</div><strong>${esc(tier.approverLabel)}</strong><div class="muted small">${esc(tierRangeText(tier))}</div></div><div><div class="kicker">Proveedor</div><strong>${esc(getProvider(request.awardedProviderId)?.name || 'Por adjudicar')}</strong></div></div><div class="callout info section-gap">${icon('info', 20)}<span>El sistema registra decisiones, cambios de titular y efectos presupuestarios en una auditoría inmutable.</span></div></div><div>${renderOwnership(request)}</div></div><div class="card card-pad section-gap"><div class="split"><div><h3>Modalidad de compra</h3><p class="muted">Activa trato directo cuando corresponda y deja el motivo en auditoría.</p></div><label class="switch" title="Activar trato directo"><input type="checkbox" data-action="toggle-direct-deal" data-id="${request.id}" ${request.directDeal ? 'checked' : ''} ${!can('directDeal') || PRE_APPROVAL_STATUSES.indexOf(request.status) === -1 || request.status === 'En visado' ? 'disabled' : ''} /><span class="switch-track"></span><strong>${request.directDeal ? 'Trato directo' : 'Compra normal'}</strong></label></div></div>${request.status === 'Contrato cerrado' ? `<div class="callout info section-gap">${icon('lock-keyhole', 20)}<span><strong>Proceso cerrado.</strong> Este contrato está cerrado y no puede modificarse. Cualquier necesidad adicional requiere una nueva solicitud.</span></div>` : ''}`;
}

/* ===== P-06: visado por tramos ===== */
function renderTierTable(activeId) {
  return `<div class="card table-card"><div class="table-wrap"><table class="data-table tier-table"><thead><tr><th>Tramo</th><th>Monto de la compra</th><th>Aprobador requerido</th></tr></thead><tbody>${APPROVAL_TIERS.map((tier, index) => `<tr class="${tier.id === activeId ? 'tier-active' : ''}"><td><strong>Tramo ${index + 1}</strong></td><td>${esc(tierRangeText(tier))}</td><td>${esc(tier.approverLabel)}${tier.id === activeId ? ' <span class="status-badge status-info">Esta solicitud</span>' : ''}</td></tr>`).join('')}</tbody></table></div></div>`;
}

function renderVisadoTimeline(requestId) {
  const approvals = state.approvals.filter((approval) => approval.requestId === requestId).sort((a, b) => new Date(a.decidedAt || a.requestedAt) - new Date(b.decidedAt || b.requestedAt));
  if (!approvals.length) return '<div class="empty-state">Aún no hay visados para esta solicitud.</div>';
  const verbs = { Aprobada: 'Aprobado', Devuelta: 'Devuelto', Rechazada: 'Rechazado' };
  return `<div class="timeline">${approvals.map((approval) => `<div class="timeline-event tl-${approval.status.toLowerCase()}"><div class="timeline-dot"></div><strong>${approval.status === 'Pendiente' ? `Pendiente de visado: requiere ${esc(getTier(approval.amount).approverLabel)}` : `${verbs[approval.status]} por ${esc(approval.decidedBy)} · ${esc(approval.decidedRole)}`}</strong><div class="timeline-meta"><span>${formatDateTime(approval.decidedAt || approval.requestedAt)}</span><span>Solicitó: ${esc(approval.requestedBy)}</span><span>Monto visado: ${formatCLP(approval.amount)}</span></div>${approval.note ? `<div class="timeline-note">${esc(approval.note)}</div>` : ''}</div>`).join('')}</div>`;
}

function renderApprovalDetail(request) {
  const tier = getTier(request.amount);
  const role = state.currentUser.role;
  const pending = request.status === 'En visado';
  const allowed = canVisar(role, request.amount);
  const account = computeAccount(request.year);
  const lacksFunds = hasInsufficientFunds(request);
  const permission = pending ? (allowed ? `<div class="callout success" role="status">${icon('circle-check', 20)}<span><strong>Tu rol (${esc(role)}) tiene atribución para visar esta compra.</strong></span></div>` : `<div class="callout danger" role="alert">${icon('ban', 20)}<span><strong>${esc(visadoBlockText(request, role))}.</strong> Tu rol actual: ${esc(role)}.</span></div>`) : `<div class="callout info">${icon('info', 20)}<span>Esta solicitud no está pendiente de visado (estado: ${esc(request.status)}).</span></div>`;
  const effect = pending ? `<div class="card card-pad section-gap"><h3>Efecto sobre el fondo si se aprueba</h3><div class="grid grid-3" style="margin-top:8px"><div><div class="kicker">Saldo comprometido actual</div><strong class="amount">${formatCLP(account.saldoComprometido)}</strong></div><div><div class="kicker">Monto a visar</div><strong class="amount">${formatCLP(request.amount)}</strong></div><div><div class="kicker">Saldo comprometido después</div><strong class="amount ${lacksFunds ? 'negative' : ''}">${formatCLP(account.saldoComprometido - request.amount)}</strong></div></div><p class="muted" style="margin:12px 0 0">La aprobación descuenta el disponible una sola vez. ${lacksFunds ? 'Los fondos son insuficientes: el sistema rechazará el visado (P-12).' : 'Adjudicar, devengar o pagar no lo descuenta de nuevo.'}</p></div>` : '';
  const visado = renderVisadoButtons(request, { small: false });
  const buttons = visado.html ? `<div class="inline-actions section-gap">${visado.html}${renderReasons([visado.reason])}</div>` : '';
  return `<div class="section-heading"><div><p class="eyebrow">P-06 · Visado de la compra</p><h2>Tramo y aprobador requerido</h2><p class="muted">Cada compra la visa el nivel que corresponde a su monto. Devolver o rechazar exige una observación.</p></div></div><div class="grid grid-3"><div class="card card-pad"><div class="kicker">Monto a visar</div><div class="account-value amount">${formatCLP(request.amount)}</div></div><div class="card card-pad"><div class="kicker">Tramo</div><div class="account-value">Tramo ${tierIndex(tier) + 1}</div><div class="muted">${esc(tierRangeText(tier))}</div></div><div class="card card-pad tier-required"><div class="kicker">Aprobador requerido</div><div class="account-value">${esc(tier.approverLabel)}</div><div class="muted">Rol: ${esc(tier.approverRole)}</div></div></div><div class="section-gap">${permission}</div>${effect}${buttons}<div class="section-gap"><h3>Tramos de visado vigentes</h3>${renderTierTable(tier.id)}</div><div class="section-gap"><h3>Línea de tiempo de visados</h3>${renderVisadoTimeline(request.id)}</div>`;
}

function renderApprovals() {
  const pending = pendingRequests();
  const role = state.currentUser.role;
  const mine = pendingForRole(role).length;
  return `${renderPageHeader('Control · P-06 · visado', 'Visado', 'Compras que esperan visado. Cada una la decide el nivel que corresponde a su monto.', '')}<div class="grid grid-3"><div class="card stat-card"><div class="stat-top"><span>En espera de visado</span>${icon('hourglass', 22)}</div><div class="stat-value">${pending.length}</div><div class="stat-foot warning">Decisiones pendientes</div></div><div class="card stat-card"><div class="stat-top"><span>Puedes visar tú (${esc(role)})</span>${icon('stamp', 22)}</div><div class="stat-value">${mine}</div><div class="stat-foot">Dentro de tu tramo</div></div><div class="card stat-card"><div class="stat-top"><span>Devueltas</span>${icon('corner-down-left', 22)}</div><div class="stat-value">${state.requests.filter((request) => request.status === 'Devuelta con observaciones').length}</div><div class="stat-foot">Pueden reenviarse</div></div></div><section class="section-gap"><h2>Tramos de visado</h2>${renderTierTable()}</section><section class="section-gap"><div class="card table-card"><div class="table-caption"><div><h3>Cola de visado</h3><span class="caption-meta">Solicitudes pendientes, con su tramo y el aprobador requerido</span></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Solicitud</th><th>Descripción</th><th>Monto</th><th>Tramo</th><th>Aprobador requerido</th><th>Tu atribución</th><th>Acciones</th></tr></thead><tbody>${pending.length ? pending.map((request) => { const tier = getTier(request.amount); const allowed = canVisar(role, request.amount); return `<tr><td><button type="button" class="table-link table-id" data-route="solicitud" data-id="${request.id}" data-tab="aprobaciones">${request.id}</button></td><td>${esc(request.description)}<div class="muted small">Comprador: ${esc(request.buyer)}</div></td><td class="amount">${formatCLP(request.amount)}</td><td>Tramo ${tierIndex(tier) + 1}</td><td><strong>${esc(tier.approverLabel)}</strong></td><td>${allowed ? '<span class="status-badge status-success">Puedes visar</span>' : `<span class="status-badge status-danger">Requiere ${esc(tier.approverRole)}</span>`}</td><td><div class="inline-actions"><button type="button" class="btn btn-secondary btn-sm" data-route="solicitud" data-id="${request.id}" data-tab="aprobaciones">Revisar</button>${renderVisadoButtons(request, { only: ['approve-request', 'open-return'] }).html}</div></td></tr>`; }).join('') : '<tr><td colspan="7"><div class="empty-state">No hay aprobaciones pendientes.</div></td></tr>'}</tbody></table></div></div></section>`;
}

/* ===== P-12: rechazo por fondos insuficientes ===== */
function renderInsufficientFunds(requestId) {
  const request = getRequest(requestId) || pendingRequests()[0];
  if (!request) return `${renderPageHeader('P-12 · Control de fondos', 'Fondos insuficientes', '', '')}<div class="empty-state">No hay una solicitud seleccionada.</div>`;
  const account = computeAccount(request.year);
  const missing = request.amount - account.saldoComprometido;
  const short = missing > 0;
  const status = request.overBudget ? `<div class="callout info section-gap">${icon('info', 20)}<span><strong>Sobregiro autorizado.</strong> La compra puede visarse aunque supere el saldo.</span></div>` : short ? `<div class="callout danger section-gap" role="alert">${icon('trending-down', 22)}<span><strong>Visado rechazado por fondos insuficientes.</strong> La compra ${esc(request.id)} no puede visarse porque el monto solicitado supera el saldo disponible.</span></div>` : `<div class="callout success section-gap">${icon('circle-check', 20)}<span>Ahora el saldo disponible alcanza para esta compra. Puedes volver a visarla.</span></div>`;
  return `${renderPageHeader('P-12 · Control de fondos', 'Rechazo por fondos insuficientes', `${request.id} · ${request.description}`, `<button type="button" class="btn btn-secondary" data-route="solicitud" data-id="${request.id}" data-tab="aprobaciones">${icon('arrow-left', 18)} Volver al visado</button>`)}${status}<div class="grid grid-3 section-gap"><article class="card account-card account-committed"><div class="account-label">Saldo disponible (comprometido) ${request.year}</div><div class="account-value amount">${formatCLP(account.saldoComprometido)}</div><div class="account-foot">Fondo asignado menos lo aprobado y devengado.</div></article><article class="card account-card"><div class="account-label">Monto solicitado</div><div class="account-value amount">${formatCLP(request.amount)}</div><div class="account-foot">Monto de la compra a visar.</div></article><article class="card account-card ${short ? 'account-short' : ''}"><div class="account-label">${short ? 'Faltante' : 'Saldo después de la compra'}</div><div class="account-value amount">${formatCLP(short ? missing : -missing)}</div><div class="account-foot">${short ? 'Monto solicitado menos saldo disponible.' : 'Disponible tras aprobar.'}</div></article></div><div class="card card-pad section-gap"><p style="margin:0">El visado se compara contra el <strong>saldo comprometido</strong>, porque ya descuenta lo aprobado y devengado. El saldo real informado es ${formatCLP(account.saldoReal)}. Puedes registrar una asignación de fondos, o solicitar autorización de sobregiro.</p></div><div class="inline-actions section-gap"><button type="button" class="btn btn-secondary" data-route="presupuesto">${icon('wallet-cards', 18)} Ver presupuesto</button>${can('overdraft') && !request.overBudget && short ? `<button type="button" class="btn btn-warning" data-action="open-overdraft" data-id="${request.id}">${icon('trending-down', 18)} Solicitar autorización de sobregiro</button>` : ''}</div>`;
}

/* ===== Documentos, cuenta corriente de la solicitud e historial ===== */
function renderDocuments(requestId) {
  const docs = state.documents.filter((doc) => doc.requestId === requestId);
  return `<div class="section-heading"><div><h2>Documentos</h2><p class="muted">Antecedentes de la solicitud y del proceso.</p></div>${can('uploadDocument') ? `<button type="button" class="btn btn-secondary" data-action="open-document-form" data-id="${requestId}">${icon('upload', 18)} Subir documento</button>` : ''}</div><div class="card table-card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Documento</th><th>Tipo</th><th>Subido por</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>${docs.length ? docs.map((doc) => `<tr><td><strong>${esc(doc.name)}</strong></td><td>${esc(doc.type)}</td><td>${esc(doc.uploadedBy)}</td><td>${formatDate(doc.date)}</td><td>${renderStatusBadge(doc.status)}</td></tr>`).join('') : '<tr><td colspan="5"><div class="empty-state">No hay documentos asociados.</div></td></tr>'}</tbody></table></div></div>`;
}

function renderRequestBudget(request) {
  const account = computeAccount(request.year);
  const contract = getContract(request.id);
  const rows = account.lines.filter((line) => line.requestId === request.id).reverse();
  const steps = ['Aprobado', 'Devengado', 'Ejecutado'].map((type) => [type, account.lines.some((line) => line.requestId === request.id && line.type === type)]);
  return `<div class="section-heading"><div><h2>Impacto en el presupuesto</h2><p class="muted">La aprobación compromete el fondo una sola vez; el pago ejecutado solo baja el saldo real.</p></div></div>${canAccess('presupuesto') ? budgetSummary(account) : ''}<div class="grid grid-2 section-gap"><div class="card card-pad"><div class="kicker">Estado de este proceso</div><div class="account-value amount">${formatCLP(request.amount)}</div>${steps.map(([type, done]) => `<div class="split" style="margin-top:10px"><span>${type}</span><strong>${done ? 'Sí' : 'No'}</strong></div>`).join('')}${can('executePayment') && contract?.devengo && !contract.paid ? `<button type="button" class="btn btn-success" style="margin-top:17px" data-action="execute-payment" data-id="${request.id}">${icon('circle-dollar-sign', 18)} Pago ejecutado</button>` : ''}</div><div class="card card-pad"><div class="kicker">Regla aplicada</div><p style="margin:9px 0 0">Al <strong>aprobar</strong>, el monto baja el saldo comprometido una sola vez. <strong>Devengar</strong> (cerrar contrato) no vuelve a descontar. <strong>Ejecutar el pago</strong> baja el saldo real y no descuenta otra vez lo comprometido.</p></div></div><div class="section-gap"><h3>Movimientos de esta solicitud</h3><div class="card table-card"><div class="table-wrap"><table class="data-table ledger-table"><thead><tr>${ledgerHeaders()}</tr></thead><tbody>${renderLedgerRows(rows)}</tbody></table></div></div></div>`;
}

function renderRequestHistory(requestId) {
  const events = state.auditEvents.filter((event) => event.object === requestId);
  return `<div class="section-heading"><div><h2>Historial de la transacción</h2><p class="muted">Trazabilidad completa desde la solicitud hasta el contrato.</p></div>${canAccess('auditoria') ? `<button type="button" class="btn btn-secondary" data-route="auditoria">Ver auditoría central ${icon('arrow-right', 18)}</button>` : ''}</div>${events.length ? `<div class="timeline">${events.map(renderAuditEvent).join('')}</div>` : '<div class="empty-state">Aún no hay eventos registrados.</div>'}`;
}

function renderAuditEvent(event) {
  return `<div class="timeline-event"><div class="timeline-dot"></div><strong>${esc(event.user)}${event.role ? ` <span class="role-tag">${esc(event.role)}</span>` : ''} ${esc(event.action)}.</strong><div class="timeline-meta"><span class="audit-time">${formatDateTime(event.at)}</span><span>Objeto: ${esc(event.object)}</span><span>${event.previous === '—' ? 'Creación' : `${esc(event.previous)} → ${esc(event.next)}`}</span></div>${event.note ? `<div class="timeline-note">${esc(event.note)}</div>` : ''}</div>`;
}

/* ===== Otras pantallas ===== */
function renderContracts() {
  return `${renderPageHeader('Control · cierre', 'Contratos', 'Consulta contratos activos y procesos cerrados sin perder el vínculo con su solicitud.', '')}<div class="grid grid-2">${state.contracts.map((contract) => { const request = getRequest(contract.requestId); const provider = getProvider(contract.providerId); return `<article class="card card-pad"><div class="split"><div><div class="kicker mono">${contract.id}</div><h3 style="margin-top:6px">${esc(request?.description || 'Contrato municipal')}</h3></div>${renderStatusBadge(contract.status)}</div><div class="grid grid-2" style="margin-top:18px"><div><div class="kicker">Proveedor</div><strong>${esc(provider?.name || '—')}</strong></div><div><div class="kicker">Monto</div><strong class="amount">${formatCLP(contract.amount)}</strong></div><div><div class="kicker">Devengado</div><strong>${contract.devengo ? 'Sí' : 'No'}</strong></div><div><div class="kicker">Pago ejecutado</div><strong>${contract.paid ? 'Sí' : 'No'}</strong></div><div class="form-full"><div class="kicker">Contrato firmado y timbrado</div><strong>${contract.signedDoc ? `${icon('paperclip', 16)} ${esc(contract.signedDoc.name)}` : '<span class="status-badge status-warning">Pendiente de adjuntar</span>'}</strong></div></div><div class="inline-actions" style="margin-top:18px"><button type="button" class="btn btn-secondary btn-sm" data-route="solicitud" data-id="${contract.requestId}">Ver proceso ${icon('arrow-up-right', 16)}</button>${contract.status === 'Cerrado' ? '<span class="muted">Solo lectura · proceso cerrado</span>' : ''}</div></article>`; }).join('')}</div>`;
}

function renderProviders() {
  return `${renderPageHeader('Control · terceros', 'Proveedores', 'Un registro contextual para entender adjudicaciones, contratos y cumplimiento.', '')}<div class="card table-card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Proveedor</th><th>RUT</th><th>Procesos adjudicados</th><th>Monto total</th><th>Cumplimiento</th><th>Estado</th><th></th></tr></thead><tbody>${state.providers.map((provider) => `<tr><td><button type="button" class="table-link" data-route="proveedor" data-id="${provider.id}">${esc(provider.name)}</button></td><td class="mono">${esc(provider.rut)}</td><td>${provider.processes}</td><td class="amount">${formatCLP(provider.total)}</td><td><strong>${provider.compliance}%</strong><div class="muted small">${provider.actualDays > provider.offeredDays ? `${provider.actualDays - provider.offeredDays} días de atraso` : 'Dentro de plazo'}</div></td><td>${renderStatusBadge(provider.status)}</td><td><button type="button" class="btn btn-ghost btn-sm" data-route="proveedor" data-id="${provider.id}">Detalle ${icon('arrow-right', 16)}</button></td></tr>`).join('')}</tbody></table></div></div>`;
}

function renderProviderDetail(providerId) {
  const provider = getProvider(providerId) || state.providers[0];
  const providerQuotes = Object.entries(state.quotes).flatMap(([requestId, quotes]) => quotes.filter((quote) => quote.providerId === provider.id).map((quote) => ({ ...quote, requestId, request: getRequest(requestId) })));
  return `${renderPageHeader('Proveedor', provider.name, 'Ficha consolidada de procesos, cotizaciones, adjudicaciones y desempeño.', `<button type="button" class="btn btn-secondary" data-route="proveedores">${icon('arrow-left', 18)} Volver</button>`)}<div class="grid grid-4"><div class="card stat-card"><div class="stat-top"><span>RUT</span>${icon('badge-info', 22)}</div><div class="stat-value mono" style="font-size:22px">${esc(provider.rut)}</div><div class="stat-foot">Registro vigente</div></div><div class="card stat-card"><div class="stat-top"><span>Procesos adjudicados</span>${icon('briefcase-business', 22)}</div><div class="stat-value">${provider.processes}</div><div class="stat-foot">Historial municipal</div></div><div class="card stat-card"><div class="stat-top"><span>Monto total</span>${icon('circle-dollar-sign', 22)}</div><div class="stat-value amount" style="font-size:22px">${formatCLP(provider.total)}</div><div class="stat-foot">Acumulado</div></div><div class="card stat-card"><div class="stat-top"><span>Cumplimiento</span>${icon('timer', 22)}</div><div class="stat-value">${provider.compliance}%</div><div class="stat-foot ${provider.compliance >= 85 ? 'positive' : 'warning'}">${provider.actualDays > provider.offeredDays ? `${provider.actualDays - provider.offeredDays} días de atraso` : 'Dentro de plazo'}</div></div></div><section class="card card-pad section-gap"><div class="section-heading"><div><h2>Antecedentes y desempeño</h2><p class="muted">Contacto ${esc(provider.contact)}</p></div>${renderStatusBadge(provider.status)}</div><div class="grid grid-3"><div><div class="kicker">Plazo ofertado</div><strong>${provider.offeredDays} días</strong></div><div><div class="kicker">Entrega real</div><strong>${provider.actualDays} días</strong></div><div><div class="kicker">Resultado</div><strong>${provider.actualDays > provider.offeredDays ? `${provider.actualDays - provider.offeredDays} días de atraso` : 'Cumplimiento en plazo'}</strong></div></div></section><section class="section-gap"><div class="section-heading"><div><h2>Cotizaciones registradas</h2><p class="muted">Procesos donde este proveedor ha participado.</p></div></div><div class="card table-card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Solicitud</th><th>Descripción</th><th>Oferta</th><th>Puntaje</th><th>Resultado</th></tr></thead><tbody>${providerQuotes.length ? providerQuotes.map((quote) => `<tr><td><button type="button" class="table-link table-id" data-route="solicitud" data-id="${quote.requestId}">${quote.requestId}</button></td><td>${esc(quote.request?.description || '—')}</td><td class="amount">${formatCLP(quote.price)}</td><td class="mono">${formatScore(calculateQuoteScore(quote))}</td><td>${quote.request?.status ? renderStatusBadge(quote.request.status) : '—'}</td></tr>`).join('') : '<tr><td colspan="5"><div class="empty-state">No hay cotizaciones registradas.</div></td></tr>'}</tbody></table></div></div></section>`;
}

function renderUsers() {
  return `${renderPageHeader('Administración · accesos', 'Usuarios', 'Administra roles y estados sin borrar físicamente la historia del sistema.', `<button type="button" class="btn btn-primary" data-action="open-user-form">${icon('user-plus', 18)} Crear usuario</button>`)}<div class="card table-card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Nombre</th><th>Rol</th><th>Departamento</th><th>Estado</th><th>Último acceso</th><th>Acciones</th></tr></thead><tbody>${state.users.map((user) => `<tr><td><strong>${esc(user.name)}</strong>${user.role === 'Pasante' ? '<div class="muted small">Acceso restringido</div>' : ''}${user.role === ROLE_SUPER ? '<div class="muted small">Máxima jerarquía de visado</div>' : ''}</td><td>${esc(user.role)}</td><td>${esc(user.department)}</td><td>${renderStatusBadge(user.status)}</td><td>${formatDateTime(user.lastAccess)}</td><td class="actions">${user.status === 'Activo' ? `<button type="button" class="btn btn-warning btn-sm" data-action="deactivate-user" data-id="${user.id}">Desactivar</button>` : '<span class="muted">Inactivo · sin acceso · visible en auditoría</span>'}</td></tr>`).join('')}</tbody></table></div></div>`;
}

function renderSettings() {
  return `${renderPageHeader('Administración · reglas', 'Configuración', 'Parámetros que cambian el comportamiento del flujo y quedan registrados en auditoría.', '')}<div class="grid grid-2"><section class="card card-pad"><div class="section-heading"><div><h2>Tramos de visado</h2><p class="muted">Solo lectura. Se definen en la constante APPROVAL_TIERS, al inicio de app.js.</p></div>${icon('stamp', 24)}</div>${renderTierTable()}<div class="callout info" style="margin-top:16px">${icon('info', 20)}<span>Cada rol puede visar su tramo y los inferiores. El Superusuario de visado tiene la máxima jerarquía. Devolver o rechazar exige observación y aprobar exige confirmación.</span></div></section><section class="card card-pad"><div class="section-heading"><div><h2>Año presupuestario</h2><p class="muted">Define el presupuesto que se muestra por defecto.</p></div>${icon('sliders-horizontal', 24)}</div><form data-form="settings"><div><label for="setting-year">Año presupuestario actual</label><input id="setting-year" name="currentYear" type="number" min="2020" max="${new Date().getFullYear()}" value="${state.settings.currentYear}" /><div class="field-hint">No se permiten años futuros.</div></div><div class="page-actions" style="margin-top:20px;justify-content:flex-start"><button type="submit" class="btn btn-primary">Guardar configuración</button></div></form><div class="grid" style="margin-top:22px;gap:12px"><div class="split"><span>Visado estricto por tramos</span><strong class="status-badge status-success">Activo</strong></div><div class="split"><span>Presupuesto derivado de movimientos</span><strong class="status-badge status-success">Activo</strong></div><div class="split"><span>Auditoría inmutable</span><strong class="status-badge status-success">Activo</strong></div><div class="split"><span>Contratos cerrados editables</span><strong class="status-badge status-danger">No</strong></div></div></section></div>`;
}

function renderAudit() {
  const search = (state.filters.audit?.search || '').toLowerCase();
  const events = state.auditEvents.filter((event) => !search || [event.user, event.role, event.action, event.object, event.note].join(' ').toLowerCase().includes(search));
  return `${renderPageHeader('Control · trazabilidad', 'Auditoría', 'Un registro inmutable para reconstruir cada decisión, cambio y efecto presupuestario.', `<button type="button" class="btn btn-secondary" data-action="export-audit" data-format="CSV">${icon('download', 18)} Exportar CSV</button><button type="button" class="btn btn-secondary" data-action="export-audit" data-format="PDF">${icon('file-down', 18)} Exportar PDF</button>`)}<div class="filter-bar"><div class="filter-field search-field"><label for="audit-search">Buscar evento</label><input id="audit-search" data-filter-scope="audit" data-filter-key="search" value="${esc(state.filters.audit?.search || '')}" placeholder="Usuario, rol, acción, objeto u observación" /></div><div class="muted" style="padding-bottom:12px">${state.auditEvents.length} eventos inmutables</div></div><section class="card card-pad section-gap"><div class="timeline">${events.map(renderAuditEvent).join('')}</div><div class="callout info" style="margin-top:20px">${icon('lock-keyhole', 20)}<span>La auditoría es visualmente inmutable. No existen acciones para editar o eliminar eventos.</span></div></section>`;
}

/* ===== P-11: renovación de equipos ===== */
function equipmentAge(startDate) {
  const start = parseDate(startDate); const now = new Date();
  let months = ((now.getFullYear() - start.getFullYear()) * 12) + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  months = Math.max(0, months);
  const years = Math.floor(months / 12); const rest = months % 12;
  const text = `${years} año${years === 1 ? '' : 's'}${rest ? ` y ${rest} mes${rest === 1 ? '' : 'es'}` : ''}`;
  return { months, text, completed: months >= RENEWAL_MONTHS, remaining: Math.max(0, RENEWAL_MONTHS - months) };
}

function renderEquipment() {
  const filters = state.filters.equip || {};
  const all = state.equipment.map((item) => ({ ...item, age: equipmentAge(item.startDate) }));
  const shown = all.filter((item) => (!filters.category || item.category === filters.category) && (!filters.age || (filters.age === 'cumplidos') === item.age.completed)).sort((a, b) => Number(b.age.completed) - Number(a.age.completed) || a.startDate.localeCompare(b.startDate));
  const done = all.filter((item) => item.age.completed);
  const perCategory = Object.keys(EQUIPMENT_CATEGORIES).map((key) => `${key}: ${all.filter((item) => item.category === key).length}`).join(' · ');
  const indicator = (item) => (item.age.completed ? `<span class="tag-3y">${icon('badge-check', 18)} 3 años cumplidos</span>` : `<span class="muted">Faltan ${item.age.remaining} mes${item.age.remaining === 1 ? '' : 'es'}</span>`);
  const field = (key, id, label, options) => `<div class="filter-field"><label for="equip-${id}">${label}</label><select id="equip-${id}" data-filter-scope="equip" data-filter-key="${key}">${options.map(([value, text]) => `<option value="${value}" ${filters[key] === value ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></div>`;
  return `${renderPageHeader('Control · P-11 · activos', 'Renovación de equipos', 'Equipos por categoría y fecha de inicio. Se destacan los que cumplieron 3 años de uso y deben evaluarse para renovación.', '')}<div class="grid grid-3"><div class="card stat-card"><div class="stat-top"><span>Equipos registrados</span>${icon('laptop', 22)}</div><div class="stat-value">${all.length}</div><div class="stat-foot">Por categoría · ${perCategory}</div></div><div class="card stat-card stat-highlight"><div class="stat-top"><span>Con 3 años cumplidos</span>${icon('badge-check', 22)}</div><div class="stat-value">${done.length}</div><div class="stat-foot warning">Candidatos a renovación</div></div><div class="card stat-card"><div class="stat-top"><span>Categoría B con 3 años cumplidos</span>${icon('monitor', 22)}</div><div class="stat-value">${done.filter((item) => item.category === 'B').length}</div><div class="stat-foot">Equipos de puesto de trabajo</div></div></div><div class="callout info section-gap">${icon('info', 20)}<span>Categorías de ejemplo: ${Object.entries(EQUIPMENT_CATEGORIES).map(([key, text]) => `<strong>${key}</strong> = ${esc(text)}`).join(' · ')}. Los criterios definitivos se confirman con el cliente.</span></div><section class="section-gap"><div class="filter-bar">${field('category', 'category', 'Categoría', [['', 'Todas'], ...Object.keys(EQUIPMENT_CATEGORIES).map((key) => [key, `Categoría ${key}`])])}${field('age', 'age', 'Antigüedad', [['', 'Todas'], ['cumplidos', '3 años cumplidos'], ['pendientes', 'Aún no cumplen']])}<button type="button" class="btn btn-secondary" data-action="clear-filters" data-scope="equip">${icon('rotate-ccw', 18)} Limpiar</button></div></section><section class="section-gap"><div class="section-heading"><div><h2>Equipos</h2><p class="muted">Los equipos con 3 años cumplidos aparecen primero.</p></div><span class="muted">${shown.length} de ${all.length} equipos</span></div><div class="card table-card"><div class="table-wrap"><table class="data-table equipment-table"><thead><tr><th>Equipo</th><th>Categoría</th><th>Departamento y responsable</th><th>Fecha de inicio</th><th>Antigüedad</th><th>Indicador</th><th>Renovación</th></tr></thead><tbody>${shown.length ? shown.map((item) => `<tr class="${item.age.completed ? 'row-renew' : ''}"><td><strong>${esc(item.name)}</strong><div class="muted small mono">${item.id}</div></td><td><span class="cat-tag cat-${item.category}">Categoría ${item.category}</span></td><td>${esc(item.department)}<div class="muted small">${esc(item.holder)}</div></td><td class="no-wrap">${formatDate(item.startDate)}</td><td>${esc(item.age.text)}</td><td>${indicator(item)}</td><td>${item.renewalRequestId ? `<button type="button" class="table-link table-id" data-route="solicitud" data-id="${item.renewalRequestId}">${item.renewalRequestId}</button>` : '<span class="muted">Sin solicitud</span>'}</td></tr>`).join('') : `<tr><td colspan="7"><div class="empty-state">${icon('search-x', 28)}<strong>No hay equipos con estos filtros</strong></div></td></tr>`}</tbody></table></div></div></section>`;
}

function renderApp() {
  const loginRoot = document.querySelector('#login-root');
  const app = document.querySelector('#app');
  if (!state.session.loggedIn) {
    app.hidden = true; loginRoot.hidden = false;
    loginRoot.innerHTML = renderLogin();
    renderIcons();
    return;
  }
  loginRoot.hidden = true; loginRoot.innerHTML = ''; app.hidden = false;
  let current = getRoute();
  if (location.hash.startsWith('#cuenta-corriente')) history.replaceState(null, '', location.hash.replace('#cuenta-corriente', '#presupuesto'));
  if (!routeExists(current.route)) current = { route: 'dashboard', id: null, tab: 'resumen' };
  if (!canAccess(current.route)) {
    showToast(`Tu rol (${state.currentUser.role}) no tiene acceso a esa sección.`, 'warning');
    history.replaceState(null, '', '#dashboard');
    current = { route: 'dashboard', id: null, tab: 'resumen' };
  }
  renderShell();
  const views = {
    dashboard: () => renderDashboard(),
    solicitudes: () => renderRequests(),
    'mis-compras': () => renderRequests('mine', 'mine'),
    cotizaciones: () => renderQuoteIndex(),
    aprobaciones: () => renderApprovals(),
    contratos: () => renderContracts(),
    'presupuesto': () => renderAccount(),
    'renovacion-equipos': () => renderEquipment(),
    'fondos-insuficientes': () => renderInsufficientFunds(current.id),
    proveedores: () => (current.id ? renderProviderDetail(current.id) : renderProviders()),
    proveedor: () => renderProviderDetail(current.id),
    auditoria: () => renderAudit(),
    usuarios: () => renderUsers(),
    configuracion: () => renderSettings(),
    solicitud: () => renderRequestDetail(current.id || state.selectedRequestId),
  };
  document.querySelector('#view-root').innerHTML = views[current.route]();
  renderIcons();
}

function routeExists(route) { return Object.prototype.hasOwnProperty.call(ROUTE_ACCESS, route); }

/* ===== Formularios y diálogos ===== */
function formHeader(title, description) { return `<div class="modal-header"><div><h2 id="modal-title">${esc(title)}</h2><p>${esc(description)}</p></div><button type="button" class="modal-close" data-action="close-modal" aria-label="Cerrar diálogo">${icon('x', 22)}</button></div>`; }
function formFooter(cancel = 'Cancelar', submit = 'Guardar') { return `<div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal">${cancel}</button><button type="submit" class="btn btn-primary">${submit}</button></div>`; }
function budgetYears() { return [...new Set([...state.ledger.map((row) => row.year), state.settings.currentYear])].filter((year) => year <= state.settings.currentYear).sort((a, b) => b - a); }
function noteField(id, label, placeholder) { return `<label for="${id}">${label} *</label><textarea id="${id}" name="note" required data-min-chars="${MIN_NOTE_CHARS}" placeholder="${esc(placeholder)}"></textarea><div class="field-hint">Obligatorio. Mínimo ${MIN_NOTE_CHARS} caracteres; queda registrado en el historial.</div>`; }
function factRow(label, value) { return `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`; }

function openNewRequestModal() {
  openModal(`${formHeader('Nueva solicitud', 'Registra una necesidad de compra y asígnala a un comprador.')}<form data-form="new-request" novalidate><div class="modal-body"><div class="form-grid"><div><label for="request-department">Departamento *</label><select id="request-department" name="department" required><option value="">Seleccionar</option>${['Finanzas', 'DIDECO', 'Obras Municipales', 'Salud', 'Educación', 'Secretaría Municipal', 'Medio Ambiente'].map((item) => `<option>${item}</option>`).join('')}</select></div><div><label for="request-buyer">Comprador asignado *</label><select id="request-buyer" name="buyer" required><option value="">Seleccionar</option>${state.users.filter((user) => user.role === 'Comprador' && user.status === 'Activo').map((user) => `<option>${esc(user.name)}</option>`).join('')}</select></div><div class="form-full"><label for="request-description">Descripción del bien o servicio *</label><input id="request-description" name="description" required placeholder="Ej.: Adquisición de notebooks" /></div><div><label for="request-quantity">Cantidad *</label><input id="request-quantity" name="quantity" type="number" inputmode="numeric" required placeholder="10" /></div><div><label for="request-amount">Monto estimado (CLP) *</label><input id="request-amount" name="amount" type="text" inputmode="numeric" autocomplete="off" required placeholder="12500000" /><div class="field-hint">Define el tramo de visado: se mostrará al enviarla.</div></div><div><label for="request-date">Fecha requerida *</label><input id="request-date" name="requiredDate" type="date" required /></div><div><label for="request-year">Año presupuestario</label><select id="request-year" name="year"><option value="${state.settings.currentYear}">${state.settings.currentYear} · actual</option>${budgetYears().filter((year) => year < state.settings.currentYear).map((year) => `<option value="${year}">${year}</option>`).join('')}</select></div><div class="form-full"><label for="request-observations">Observaciones</label><textarea id="request-observations" name="observations" placeholder="Antecedentes o contexto para el comprador"></textarea></div></div></div>${formFooter('Cancelar', 'Crear solicitud')}</form>`);
}

function openQuoteModal(requestId) {
  const request = getRequest(requestId);
  openModal(`${formHeader('Registrar cotización', request?.description || 'Agrega antecedentes del proveedor.')}<form data-form="quote" data-request-id="${requestId}"><div class="modal-body"><div class="form-grid"><div class="form-full"><label for="quote-provider">Proveedor *</label><select id="quote-provider" name="providerId" required><option value="">Seleccionar proveedor</option>${state.providers.filter((provider) => provider.status === 'Activo').map((provider) => `<option value="${provider.id}">${esc(provider.name)} · ${esc(provider.rut)}</option>`).join('')}</select></div><div><label for="quote-price">Valor oferta (CLP) *</label><input id="quote-price" name="price" type="number" min="1" required placeholder="11800000" /></div><div><label for="quote-economic">Nota valor económico *</label><input id="quote-economic" name="economic" type="number" min="1" max="7" step="1" required placeholder="1 a 7" /></div><div><label for="quote-technical">Nota calidad técnica *</label><input id="quote-technical" name="technical" type="number" min="1" max="7" step="1" required placeholder="1 a 7" /></div><div><label for="quote-delivery">Nota tiempo de entrega *</label><input id="quote-delivery" name="delivery" type="number" min="1" max="7" step="1" required placeholder="1 a 7" /></div></div><div class="callout info" style="margin-top:17px">${icon('calculator', 20)}<span>El puntaje final pondera 50% valor económico, 25% calidad técnica y 25% tiempo de entrega. Si dos cotizaciones empatan en el primer lugar, decide el aprobador.</span></div></div>${formFooter('Cancelar', 'Guardar cotización')}</form>`);
}

function openReturnModal(requestId) {
  openModal(`${formHeader('Devolver con observaciones', 'La compra volverá al comprador y podrá reenviarse a visado.')}<form data-form="return-request" data-request-id="${requestId}"><div class="modal-body">${noteField('return-note', 'Observación', 'Ej.: Se solicita revisar antecedentes técnicos del proveedor B.')}</div>${formFooter('Cancelar', 'Devolver compra')}</form>`);
}

function openRejectModal(requestId) {
  openModal(`${formHeader('Rechazar compra', 'La compra se rechaza y el proceso termina. Esta acción no se puede deshacer.')}<form data-form="reject-request" data-request-id="${requestId}"><div class="modal-body">${noteField('reject-note', 'Motivo del rechazo', 'Ej.: La compra no se ajusta a la necesidad declarada.')}</div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancelar</button><button type="submit" class="btn btn-danger">Rechazar compra</button></div></form>`);
}

function openBlockedModal(request) {
  const tier = getTier(request.amount);
  openModal(`${formHeader('Visado no permitido', `${request.id} · ${request.description}`)}<div class="modal-body"><div class="callout danger callout-lg" role="alert">${icon('ban', 26)}<span><strong>${esc(visadoBlockText(request))}.</strong></span></div><dl class="facts">${factRow('Monto de la compra', `<span class="amount">${formatCLP(request.amount)}</span>`)}${factRow('Tramo', `Tramo ${tierIndex(tier) + 1} · ${esc(tierRangeText(tier))}`)}${factRow('Aprobador requerido', esc(tier.approverLabel))}${factRow('Tu rol actual', esc(state.currentUser.role))}</dl><p class="muted" style="margin:14px 0 0">La acción no se ejecutó y el intento quedó registrado en la auditoría. Cambia de rol desde la barra superior o pide el visado a quien corresponde.</p></div><div class="modal-footer"><button type="button" class="btn btn-primary" data-action="close-modal">Entendido</button></div>`);
}

function openApproveConfirmModal(id) {
  const request = getRequest(id);
  const tier = getTier(request.amount);
  const account = computeAccount(request.year);
  const tie = getTieInfo(request);
  const awarded = getProvider(request.awardedProviderId)?.name;
  const provider = awarded || (tie.isTie ? `Empate entre ${tie.tied.map((quote) => quote.provider?.name).join(' y ')} (se define antes de adjudicar)` : tie.scored[0] ? `${tie.scored[0].provider?.name} (mejor puntaje, referencial)` : 'Por adjudicar');
  openModal(`${formHeader('Confirmar visado', 'Revisa los datos antes de aprobar. La decisión queda registrada con tu nombre, rol y fecha.')}<form data-form="confirm-approve" data-request-id="${id}"><div class="modal-body"><dl class="facts">${factRow('Solicitud', `${esc(request.id)} · ${esc(request.description)}`)}${factRow('Monto a aprobar', `<span class="amount">${formatCLP(request.amount)}</span>`)}${factRow('Proveedor', esc(provider))}${factRow('Visado', `Tramo ${tierIndex(tier) + 1} · ${esc(tier.approverLabel)}. Aprueba: ${esc(state.currentUser.name)} (${esc(state.currentUser.role)})`)}${factRow('Efecto sobre el fondo', `El saldo comprometido baja de <strong>${formatCLP(account.saldoComprometido)}</strong> a <strong>${formatCLP(account.saldoComprometido - request.amount)}</strong>. Se descuenta una sola vez: el saldo real no cambia hasta ejecutar el pago.`)}</dl></div>${formFooter('Cancelar', 'Confirmar visado')}</form>`);
}

function openAwardModal(requestId) {
  const request = getRequest(requestId);
  const tie = getTieInfo(request);
  const options = tie.decision ? tie.scored.filter((quote) => quote.id === tie.decision.quoteId) : tie.scored;
  const preferred = tie.decision?.quoteId || request.selectedQuoteId || options[0]?.id;
  openModal(`${formHeader('Adjudicar proveedor', 'Confirma el resultado de la evaluación y genera el contrato vinculado.')}<form data-form="award" data-request-id="${requestId}"><div class="modal-body"><label for="award-quote">Proveedor seleccionado *</label><select id="award-quote" name="quoteId" required>${options.map((quote) => `<option value="${quote.id}" ${quote.id === preferred ? 'selected' : ''} ${quote.price > request.amount ? 'disabled' : ''}>${esc(quote.provider.name)} · puntaje ${formatScore(quote.score)} · ${formatCLP(quote.price)}${quote.price > request.amount ? ' (supera el monto visado)' : ''}</option>`).join('')}</select>${tie.decision ? `<div class="field-hint">Cotización definida por el aprobador en el desempate.</div>` : ''}<div class="checkbox-row" style="margin-top:18px"><input id="award-confirm" type="checkbox" name="confirm" required /><label for="award-confirm">Confirmo criterio de adjudicación y la información ingresada.</label></div><div class="callout info" style="margin-top:18px">${icon('badge-check', 20)}<span>Se registrarán proveedor, puntaje, comprador, fecha y hora. Si la oferta es menor al monto visado, la diferencia se libera al saldo comprometido.</span></div></div>${formFooter('Cancelar', 'Adjudicar')}</form>`);
}

function openBudgetMovementModal(type) {
  const isTransfer = type === 'Traspaso';
  const isAction = ['Baja', 'Extinción'].includes(type);
  const years = budgetYears();
  const yearOptions = years.map((year) => `<option value="${year}">${year}</option>`).join('');
  openModal(`${formHeader(type === 'Asignación' ? 'Registrar asignación' : type, isTransfer ? 'Genera un descuento en el año de origen y una asignación en el de destino.' : isAction ? 'Esta acción exige motivo y evidencia documental.' : 'Aumenta el fondo asignado de un año.')}<form data-form="budget-movement" data-type="${type}"><div class="modal-body"><div class="form-grid">${isTransfer ? `<div><label for="budget-origin">Año origen *</label><select id="budget-origin" name="origin">${yearOptions}</select></div><div><label for="budget-destination">Año destino *</label><select id="budget-destination" name="destination">${years.slice().reverse().map((year) => `<option value="${year}">${year}</option>`).join('')}</select></div>` : `<div><label for="budget-movement-year">Año *</label><select id="budget-movement-year" name="year">${yearOptions}</select></div>`}<div><label for="budget-movement-amount">Monto (CLP) *</label><input id="budget-movement-amount" name="amount" type="number" min="1" required placeholder="5000000" /></div>${isAction ? `<div><label for="budget-reason">Motivo *</label><select id="budget-reason" name="reason" required><option value="">Seleccionar</option><option>Incumplimiento proveedor</option><option>Mandato superior</option><option>Otro</option></select></div>` : ''}<div class="form-full"><label for="budget-description">Descripción / motivo *</label><textarea id="budget-description" name="description" required placeholder="Explica el origen del movimiento"></textarea></div>${isAction ? `<div class="form-full"><label for="budget-evidence">Evidencia documental *</label><input id="budget-evidence" name="evidence" type="file" required /><div class="field-hint">El mockup exige seleccionar un archivo antes de confirmar.</div></div>` : ''}</div></div>${formFooter('Cancelar', `Confirmar ${type.toLowerCase()}`)}</form>`, { wide: true });
}

function openDocumentModal(requestId) {
  openModal(`${formHeader('Subir documento', 'Simula la incorporación de un antecedente al expediente.')}<form data-form="document" data-request-id="${requestId}"><div class="modal-body"><div class="form-grid"><div class="form-full"><label for="doc-file">Archivo *</label><input id="doc-file" name="file" type="file" required /></div><div><label for="doc-type">Tipo *</label><select id="doc-type" name="type"><option>Antecedente técnico</option><option>Evaluación</option><option>Administrativo</option><option>Cierre</option></select></div><div><label for="doc-status">Estado</label><select id="doc-status" name="status"><option>Vigente</option><option>En revisión</option></select></div></div></div>${formFooter('Cancelar', 'Subir documento')}</form>`);
}

function openUserModal() {
  openModal(`${formHeader('Crear usuario', 'Añade un acceso ficticio al directorio municipal.')}<form data-form="user"><div class="modal-body"><div class="form-grid"><div class="form-full"><label for="user-name">Nombre completo *</label><input id="user-name" name="name" required /></div><div><label for="user-role">Rol *</label><select id="user-role" name="role">${ROLES.map((role) => `<option>${esc(role)}</option>`).join('')}</select></div><div><label for="user-department">Departamento *</label><input id="user-department" name="department" required /></div></div></div>${formFooter('Cancelar', 'Crear usuario')}</form>`);
}

function openDelegateModal(requestId, reassignment = false) {
  const request = getRequest(requestId);
  const buyers = state.users.filter((user) => user.role === 'Comprador' && user.status === 'Activo' && user.name !== request?.buyer);
  openModal(`${formHeader(reassignment ? 'Reasignar transacción' : 'Delegar transacción', reassignment ? 'La Jefatura puede cambiar el responsable de una compra en curso.' : 'Selecciona el comprador que asumirá esta gestión.')}<form data-form="owner-change" data-request-id="${requestId}" data-reassignment="${reassignment}"><div class="modal-body"><div class="form-grid"><div><label for="owner-target">${reassignment ? 'Comprador destino' : 'Delegar a'} *</label><select id="owner-target" name="target" required><option value="">Seleccionar</option>${buyers.map((buyer) => `<option>${esc(buyer.name)}</option>`).join('')}</select></div><div><label for="owner-scope">Alcance</label><select id="owner-scope" name="scope"><option value="single">Solo esta transacción</option><option value="all">Todas las transacciones en curso del comprador actual</option></select></div><div class="form-full"><label for="owner-reason">Motivo</label><textarea id="owner-reason" name="reason" placeholder="Ej.: Control administrativo"></textarea></div></div></div>${formFooter('Cancelar', reassignment ? 'Reasignar' : 'Delegar')}</form>`);
}

function openTakeControlModal(requestId) {
  openModal(`${formHeader('Tomar control de esta transacción', `${state.currentUser.name} pasará a ser titular actual y se conservará el titular original.`)}<form data-form="take-control" data-request-id="${requestId}"><div class="modal-body"><label for="take-reason">Motivo *</label><textarea id="take-reason" name="reason" required>Control administrativo</textarea></div>${formFooter('Cancelar', 'Tomar control')}</form>`);
}

function openAttachContractModal(requestId) {
  const contract = getContract(requestId);
  openModal(`${formHeader('Adjuntar contrato firmado y timbrado', `${contract.id} · documento obligatorio para poder cerrar el contrato.`)}<form data-form="contract-attach" data-request-id="${requestId}" novalidate><div class="modal-body"><label for="contract-file">Archivo del contrato (PDF) *</label><input id="contract-file" name="file" type="file" accept=".pdf,application/pdf" /><div class="field-hint">El contrato debe estar firmado por ambas partes y timbrado.</div><div class="callout info" style="margin-top:16px">${icon('info', 20)}<span>Para probar el flujo sin un archivo real, usa el archivo de ejemplo.</span></div><div style="margin-top:12px"><button type="button" class="btn btn-secondary" data-action="attach-sample-contract" data-id="${requestId}">${icon('file-check', 18)} Usar archivo de ejemplo</button></div></div>${formFooter('Cancelar', 'Adjuntar contrato')}</form>`);
}

function attachSignedContract(requestId, fileName) {
  const contract = getContract(requestId);
  const user = state.currentUser;
  const replaced = Boolean(contract.signedDoc);
  contract.signedDoc = { name: fileName, at: todayISO(), by: user.name };
  state.documents.push({ id: `DOC-${String(state.documents.length + 1).padStart(3, '0')}`, requestId, name: fileName, type: 'Contrato firmado y timbrado', uploadedBy: user.name, date: todayISO(), status: 'Vigente' });
  addAuditEvent({ action: `${replaced ? 'reemplazó' : 'adjuntó'} el contrato firmado y timbrado (${fileName})`, object: requestId, previous: replaced ? 'Contrato adjunto' : 'Contrato sin adjunto', next: 'Contrato adjunto', note: contract.id });
  closeModal(); showToast('Contrato firmado y timbrado adjuntado. Ya puedes cerrar el contrato.'); navigate('solicitud', requestId);
}

// Acción bloqueada: explica el motivo y deja el intento en la auditoría.
function openBlockedReasonModal({ reason, title = 'Acción no disponible', audit = '', object = 'Sistema', previous = '—', next = '—', user = state.currentUser.name, role = state.currentUser.role, roleLabel = state.currentUser.role }) {
  if (audit) addAuditEvent({ action: audit, object, previous, next, note: reason, user, role });
  openModal(`${formHeader(title, 'Esta acción no se ejecutó.')}<div class="modal-body"><div class="callout danger callout-lg" role="alert">${icon('ban', 26)}<span><strong>${esc(reason)}</strong></span></div><dl class="facts"><div><dt>Rol</dt><dd>${esc(roleLabel)}</dd></div></dl><p class="muted" style="margin:14px 0 0">El intento quedó registrado en la auditoría.</p></div><div class="modal-footer"><button type="button" class="btn btn-primary" data-action="close-modal">Entendido</button></div>`);
}

function showBlockedAction(element) {
  const id = element.dataset.id;
  const request = id ? getRequest(id) : null;
  openBlockedReasonModal({
    reason: element.dataset.blockedReason,
    title: element.dataset.blockedTitle || 'Acción no disponible',
    audit: element.dataset.blockedAudit,
    object: id || element.dataset.blockedObject || 'Sistema',
    previous: request?.status || '—',
    next: request?.status || '—',
    user: element.dataset.blockedUser || state.currentUser.name,
    role: element.dataset.blockedRole || state.currentUser.role,
    roleLabel: element.dataset.blockedRole || state.currentUser.role,
  });
}

function confirmAction(title, copy, action, id) {
  openModal(`${formHeader(title, copy)}<div class="modal-body"><div class="callout danger">${icon('triangle-alert', 20)}<span>Esta acción se registra en auditoría y puede cambiar el estado final de la transacción.</span></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancelar</button><button type="button" class="btn btn-danger" data-action="${action}" data-id="${id}" data-confirmed="true">Confirmar</button></div>`);
}

/* ===== Validación en español (sin mensajes nativos del navegador) ===== */
function setFieldError(field, message) {
  let error = field.parentElement.querySelector(`.field-error[data-for="${field.id}"]`);
  if (!message) { error?.remove(); field.removeAttribute('aria-invalid'); field.removeAttribute('aria-describedby'); return; }
  if (!error) {
    error = document.createElement('div');
    error.className = 'field-error'; error.id = `${field.id}-error`; error.dataset.for = field.id; error.setAttribute('role', 'alert');
    field.insertAdjacentElement('afterend', error);
  }
  error.textContent = message;
  field.setAttribute('aria-invalid', 'true'); field.setAttribute('aria-describedby', error.id);
}

// Acepta "12500000", "12.500.000" o "$12.500.000". Devuelve { empty } | { invalid } | { value }.
function parseCLPInput(raw) {
  const text = String(raw ?? '').trim().replace(/^\$/, '').replace(/[.\s]/g, '');
  if (text === '') return { empty: true };
  if (!/^-?\d+$/.test(text)) return { invalid: true };
  return { value: Number(text) };
}

const NEW_REQUEST_RULES = {
  'request-department': (value) => (value ? '' : 'Selecciona un departamento.'),
  'request-buyer': (value) => (value ? '' : 'Selecciona al comprador que gestionará la compra.'),
  'request-description': (value) => (!value.trim() ? 'Escribe la descripción del bien o servicio.' : value.trim().length < 5 ? 'La descripción es muy corta: usa al menos 5 caracteres.' : ''),
  'request-quantity': (value, field) => {
    if (field.validity.badInput) return 'La cantidad debe ser un número.';
    if (value === '') return 'Ingresa la cantidad.';
    const number = Number(value);
    if (!Number.isInteger(number)) return 'La cantidad debe ser un número entero.';
    return number < 1 ? 'La cantidad debe ser mayor a 0.' : '';
  },
  'request-amount': (value) => {
    const parsed = parseCLPInput(value);
    if (parsed.empty) return 'Ingresa el monto estimado.';
    if (parsed.invalid) return 'El monto debe ser un número (ej.: 12500000). No uses letras ni símbolos.';
    if (parsed.value < 0) return 'El monto no puede ser negativo.';
    return parsed.value === 0 ? 'El monto debe ser mayor a 0.' : '';
  },
  'request-date': (value) => (value ? '' : 'Indica la fecha en que se necesita la compra.'),
};

function validateNewRequest(form) {
  let first = null;
  Object.entries(NEW_REQUEST_RULES).forEach(([id, rule]) => {
    const field = form.querySelector(`#${id}`);
    const message = rule(field.value, field);
    setFieldError(field, message);
    if (message && !first) first = field;
  });
  if (first) first.focus();
  return !first;
}

function collectForm(form) { return Object.fromEntries(new FormData(form).entries()); }

function handleFilter(element) {
  const scope = element.dataset.filterScope;
  state.filters[scope] = { ...(state.filters[scope] || {}), [element.dataset.filterKey]: element.value };
  renderApp();
  const ref = document.querySelector(`[data-filter-scope="${scope}"][data-filter-key="${element.dataset.filterKey}"]`);
  if (ref) {
    ref.focus();
    if (ref.tagName === 'INPUT' && ref.type === 'text') ref.setSelectionRange(ref.value.length, ref.value.length);
  }
}

/* ===== Visado ===== */
// Revisa la atribución del rol actual. Si no la tiene, bloquea la acción, avisa y deja el intento en auditoría.
function guardVisado(request, verb = 'visar') {
  if (canVisar(state.currentUser.role, request.amount)) return true;
  addAuditEvent({ action: `intentó ${verb} sin atribución (acción bloqueada)`, object: request.id, previous: request.status, next: request.status, note: visadoBlockText(request) });
  openBlockedModal(request);
  return false;
}

function startApprove(id) {
  const request = getRequest(id);
  if (request.status !== 'En visado') { showToast('Esta solicitud no está pendiente de visado.', 'warning'); return; }
  if (!guardVisado(request, 'aprobar')) return;
  if (hasInsufficientFunds(request)) {
    const account = computeAccount(request.year);
    addAuditEvent({ action: 'intentó aprobar: visado rechazado por fondos insuficientes', object: id, previous: request.status, next: request.status, note: `Saldo disponible ${formatCLP(account.saldoComprometido)}; monto solicitado ${formatCLP(request.amount)}.` });
    navigate('fondos-insuficientes', id);
    return;
  }
  openApproveConfirmModal(id);
}

function startDecision(id, verb, open) {
  const request = getRequest(id);
  if (request.status !== 'En visado') { showToast('Esta solicitud no está pendiente de visado.', 'warning'); return; }
  if (guardVisado(request, verb)) open(id);
}

function finalizeApproval(id) {
  const request = getRequest(id);
  const user = state.currentUser;
  if (request.status !== 'En visado') { closeModal(); showToast('Esta solicitud ya no está pendiente de visado.', 'warning'); return; }
  if (!canVisar(user.role, request.amount)) { openBlockedModal(request); return; }
  if (hasInsufficientFunds(request)) { navigate('fondos-insuficientes', id); return; }
  const tier = getTier(request.amount);
  const previous = request.status;
  const approval = getPendingApproval(id);
  if (approval) Object.assign(approval, { status: 'Aprobada', decidedBy: user.name, decidedRole: user.role, decidedAt: todayISO() });
  // La aprobación es el único movimiento que descuenta el saldo comprometido de esta compra.
  postLedger({ type: 'Aprobado', requestId: id, amount: request.amount, description: `Visado: ${tier.approverLabel}` });
  request.status = 'Visada';
  addAuditEvent({ action: 'aprobó la compra', object: id, previous, next: request.status, note: `Visado de ${tier.approverLabel}. Comprometió ${formatCLP(request.amount)} del fondo.` });
  closeModal();
  showToast(`Compra aprobada. Se comprometieron ${formatCLP(request.amount)} del fondo.`);
  navigate('solicitud', id, 'aprobaciones');
}

/* ===== Envío de formularios ===== */
function handleSubmit(form) {
  const data = collectForm(form);
  const type = form.dataset.form;
  if (type === 'new-request') { if (!validateNewRequest(form)) return; } else if (!form.noValidate && !form.reportValidity()) return;
  const user = state.currentUser;
  if (type === 'new-request') {
    const number = Math.max(...state.requests.filter((request) => request.id.startsWith(`SOL-${data.year}-`)).map((request) => Number(request.id.match(/(\d+)$/)?.[1] || 0)), 0) + 1;
    const id = `SOL-${data.year}-${String(number).padStart(3, '0')}`;
    state.requests.unshift({ id, department: data.department, description: data.description, quantity: Number(data.quantity), amount: parseCLPInput(data.amount).value, requiredDate: data.requiredDate, requester: user.name, buyer: data.buyer, ownerOriginal: data.buyer, status: 'Borrador', year: Number(data.year), createdAt: todayISO(), observations: data.observations || '', directDeal: false, overBudget: false });
    state.quotes[id] = [];
    addAuditEvent({ action: `creó ${id}`, object: id, next: 'Borrador', note: data.observations || '' });
    closeModal(); showToast(`Solicitud creada. Visado requerido: ${getTier(parseCLPInput(data.amount).value).approverLabel}.`); navigate('solicitud', id);
  } else if (type === 'quote') {
    const id = form.dataset.requestId;
    const quote = { id: `COT-${String(Object.values(state.quotes).flat().length + 1).padStart(3, '0')}`, providerId: data.providerId, price: Number(data.price), economic: Number(data.economic), technical: Number(data.technical), delivery: Number(data.delivery), createdBy: user.name, createdAt: todayISO() };
    state.quotes[id] = [...(state.quotes[id] || []), quote];
    const request = getRequest(id); const previous = request.status;
    if (['Borrador', 'Devuelta con observaciones', 'En cotización'].includes(request.status)) request.status = (request.directDeal ? state.quotes[id].length >= 1 : state.quotes[id].length >= 3) ? 'En evaluación' : 'En cotización';
    addAuditEvent({ action: `agregó cotización de ${getProvider(data.providerId)?.name}`, object: id, previous, next: request.status });
    closeModal(); showToast('Cotización guardada'); navigate('solicitud', id, 'cotizaciones');
  } else if (type === 'confirm-approve') {
    finalizeApproval(form.dataset.requestId);
  } else if (type === 'return-request' || type === 'reject-request') {
    const request = getRequest(form.dataset.requestId);
    const rejecting = type === 'reject-request';
    const note = (data.note || '').trim();
    if (request.status !== 'En visado') { closeModal(); showToast('Esta solicitud ya no está pendiente de visado.', 'warning'); return; }
    if (!canVisar(user.role, request.amount)) { openBlockedModal(request); return; }
    if (note.length < MIN_NOTE_CHARS) { showToast(`La observación es obligatoria (mínimo ${MIN_NOTE_CHARS} caracteres).`, 'error'); return; }
    const previous = request.status;
    request.status = rejecting ? 'Rechazada' : 'Devuelta con observaciones'; request.observations = note;
    const approval = getPendingApproval(request.id);
    if (approval) Object.assign(approval, { status: rejecting ? 'Rechazada' : 'Devuelta', decidedBy: user.name, decidedRole: user.role, decidedAt: todayISO(), note });
    addAuditEvent({ action: rejecting ? 'rechazó la compra' : 'devolvió la compra con observaciones', object: request.id, previous, next: request.status, note });
    closeModal(); showToast(rejecting ? 'Compra rechazada' : 'Compra devuelta con observaciones', 'warning'); navigate('solicitud', request.id, 'aprobaciones');
  } else if (type === 'tie-break') {
    const request = getRequest(form.dataset.requestId);
    const tie = getTieInfo(request);
    const note = (data.note || '').trim();
    if (!canVisar(user.role, request.amount)) { openBlockedModal(request); return; }
    if (!tie.isTie || !tie.tied.some((quote) => quote.id === data.quoteId)) { showToast('Elige una de las cotizaciones empatadas.', 'error'); return; }
    if (note.length < MIN_NOTE_CHARS) { showToast(`La justificación es obligatoria (mínimo ${MIN_NOTE_CHARS} caracteres).`, 'error'); return; }
    const chosen = tie.tied.find((quote) => quote.id === data.quoteId);
    request.tieBreak = { quoteId: chosen.id, note, by: user.name, role: user.role, at: todayISO() };
    request.selectedQuoteId = chosen.id;
    addAuditEvent({ action: `resolvió el empate de puntaje eligiendo a ${chosen.provider.name}`, object: request.id, previous: 'Empate sin resolver', next: 'Empate resuelto', note: `Puntaje ${formatScore(chosen.score)}. Justificación: ${note}` });
    showToast(`Empate resuelto: ${chosen.provider.name}`); navigate('solicitud', request.id, 'cotizaciones');
  } else if (type === 'award') {
    const request = getRequest(form.dataset.requestId);
    const award = awardState(request);
    if (!award.enabled) { showToast(award.reason || 'La adjudicación no está disponible.', 'error'); return; }
    const quote = getQuotes(request.id).find((item) => item.id === data.quoteId); const provider = getProvider(quote.providerId); const previous = request.status;
    if (quote.price > request.amount) { showToast('La oferta supera el monto visado: no puede adjudicarse.', 'error'); return; }
    request.status = 'Adjudicada'; request.awardedProviderId = provider.id;
    state.contracts = state.contracts.filter((item) => item.requestId !== request.id);
    state.contracts.unshift({ id: nextContractId(), requestId: request.id, providerId: provider.id, amount: quote.price, buyer: request.buyer, status: 'Activo', awardedAt: todayISO(), devengo: false, paid: false });
    const released = request.amount - quote.price;
    if (released > 0) postLedger({ type: 'Anulado', requestId: request.id, amount: released, description: 'Liberación por diferencia entre el monto visado y la oferta adjudicada' });
    addAuditEvent({ action: `adjudicó a ${provider.name}`, object: request.id, previous, next: request.status, note: `Criterio confirmado por el comprador.${released > 0 ? ` Se liberaron ${formatCLP(released)} al saldo comprometido.` : ''}` });
    closeModal(); showToast('Proveedor adjudicado'); navigate('solicitud', request.id);
  } else if (type === 'budget-movement') {
    handleBudgetMovement(data, form.dataset.type); return;
  } else if (type === 'contract-attach') {
    if (!data.file?.name) { setFieldError(form.querySelector('#contract-file'), 'Selecciona el archivo del contrato (PDF) o usa el archivo de ejemplo.'); return; }
    attachSignedContract(form.dataset.requestId, data.file.name);
  } else if (type === 'document') {
    const fileName = data.file?.name || 'documento-simulado.pdf';
    state.documents.push({ id: `DOC-${String(state.documents.length + 1).padStart(3, '0')}`, requestId: form.dataset.requestId, name: fileName, type: data.type, uploadedBy: user.name, date: todayISO(), status: data.status });
    addAuditEvent({ action: `subió el documento ${fileName}`, object: form.dataset.requestId, next: 'Documento vigente' });
    closeModal(); showToast('Documento subido'); navigate('solicitud', form.dataset.requestId, 'documentos');
  } else if (type === 'user') {
    state.users.push({ id: `USR-${String(state.users.length + 1).padStart(3, '0')}`, name: data.name, role: data.role, department: data.department, status: 'Activo', lastAccess: todayISO() });
    addAuditEvent({ action: `creó al usuario ${data.name}`, object: 'Usuarios', next: 'Activo' });
    closeModal(); showToast('Usuario creado'); renderApp();
  } else if (type === 'owner-change') {
    const request = getRequest(form.dataset.requestId); const previous = request.buyer; const scope = data.scope;
    const affected = scope === 'all' ? state.requests.filter((item) => item.buyer === previous && !CLOSED_STATUSES.includes(item.status)) : [request];
    affected.forEach((item) => { item.buyer = data.target; });
    addAuditEvent({ action: `reasignó ${affected.length} transacción${affected.length > 1 ? 'es' : ''} a ${data.target}`, object: request.id, previous, next: data.target, note: data.reason || 'Delegación voluntaria' });
    closeModal(); showToast(scope === 'all' ? 'Transacciones reasignadas' : 'Transacción delegada'); navigate('solicitud', request.id);
  } else if (type === 'take-control') {
    const request = getRequest(form.dataset.requestId); const previous = request.buyer; request.buyer = user.name;
    addAuditEvent({ action: 'tomó control administrativo', object: request.id, previous, next: request.buyer, note: data.reason });
    closeModal(); showToast('Control administrativo asumido'); navigate('solicitud', request.id);
  } else if (type === 'settings') {
    if (Number(data.currentYear) > new Date().getFullYear()) { showToast('El año futuro no está permitido', 'error'); return; }
    const previous = String(state.settings.currentYear);
    state.settings = { currentYear: Number(data.currentYear) };
    addAuditEvent({ action: 'modificó la configuración', object: 'Configuración', previous, next: String(state.settings.currentYear) });
    showToast('Configuración guardada'); renderApp();
  }
}

function handleBudgetMovement(data, type) {
  if (type === 'Asignación' && !can('addFunds')) { showToast(ADD_FUNDS_MESSAGE, 'error'); return; }
  if (!can('manageFunds')) { showToast('Tu rol no puede registrar movimientos de fondos.', 'error'); return; }
  const amount = Number(data.amount);
  const evidence = data.evidence?.name ? ` · Evidencia: ${data.evidence.name}` : '';
  if (type === 'Traspaso') {
    if (data.origin === data.destination) { showToast('El año origen y destino deben ser distintos', 'error'); return; }
    const origin = computeAccount(Number(data.origin));
    if (amount > origin.saldoComprometido) { showToast('El monto supera el saldo comprometido disponible del año origen', 'error'); return; }
    postLedger({ type: 'Asignación', amount: -amount, year: Number(data.origin), description: `Traspaso a ${data.destination}: ${data.description}` });
    postLedger({ type: 'Asignación', amount, year: Number(data.destination), description: `Traspaso desde ${data.origin}: ${data.description}` });
    addAuditEvent({ action: `traspasó ${formatCLP(amount)} de ${data.origin} a ${data.destination}`, object: 'Presupuesto', previous: 'Saldos separados', next: 'Movimientos vinculados', note: data.description });
  } else {
    const year = Number(data.year);
    const account = computeAccount(year);
    if (type !== 'Asignación' && amount > account.saldoComprometido) { showToast('El monto supera el saldo comprometido disponible', 'error'); return; }
    postLedger({ type: 'Asignación', amount: type === 'Asignación' ? amount : -amount, year, description: type === 'Asignación' ? data.description : `${type}${data.reason ? ` (${data.reason})` : ''}: ${data.description}` });
    addAuditEvent({ action: `registró ${type === 'Asignación' ? 'una asignación de fondos' : type.toLowerCase()}`, object: `Presupuesto ${year}`, previous: formatCLP(account.saldoComprometido), next: formatCLP(computeAccount(year).saldoComprometido), note: `${data.description}${evidence}` });
  }
  closeModal(); showToast(`${type} registrada`); navigate('presupuesto');
}

/* ===== Acciones ===== */
function loginAs(role) {
  if (!isRoleActive(role)) { openBlockedReasonModal({ reason: inactiveMessage(role), title: 'Acceso denegado', audit: 'intentó ingresar con un usuario inactivo (acceso denegado)', object: 'Inicio de sesión', user: profileUser(role).name, role, roleLabel: role }); return; }
  state.session.loggedIn = true;
  setCurrentRole(role);
  history.replaceState(null, '', '#dashboard');
  renderApp();
  window.scrollTo(0, 0);
  showToast(`Ingresaste como ${role}: ${state.currentUser.name}.`);
}

function switchRole(role) {
  if (!ROLE_PROFILES[role]) return;
  if (!isRoleActive(role)) { openBlockedReasonModal({ reason: inactiveMessage(role), title: 'Acceso denegado', audit: 'intentó ingresar con un usuario inactivo (acceso denegado)', object: 'Cambio de rol', user: profileUser(role).name, role, roleLabel: role }); renderApp(); return; }
  setCurrentRole(role);
  renderApp();
  showToast(`Ahora ves el sistema como ${role}: ${state.currentUser.name}.`);
  document.querySelector('#role-select')?.focus();
}

function handleAction(action, element) {
  const id = element?.dataset.id;
  if (action === 'open-new-request') openNewRequestModal();
  else if (action === 'close-modal') closeModal();
  else if (action === 'dismiss-toast') element.closest('.toast')?.remove();
  else if (action === 'toggle-sidebar') document.querySelector('#sidebar').classList.toggle('open');
  else if (action === 'login-role') loginAs(element.dataset.role);
  else if (action === 'show-notifications') {
    const count = pendingForRole(state.currentUser.role).length;
    showToast(roleRank(state.currentUser.role) > 0 ? `Tienes ${count} decisión${count === 1 ? '' : 'es'} de visado pendiente${count === 1 ? '' : 's'} para tu rol.` : `Hay ${pendingRequests().length} compras en visado. Tu rol no visa compras.`, 'warning');
  }
  else if (action === 'logout') { closeModal(); state.session.loggedIn = false; history.replaceState(null, '', '#dashboard'); renderApp(); }
  else if (action === 'open-quote-form') openQuoteModal(id);
  else if (action === 'toggle-direct-deal') {
    const request = getRequest(id); const previous = request.directDeal ? 'Trato directo' : 'Compra normal'; request.directDeal = element.checked; if (request.directDeal && getQuotes(id).length >= 1 && ['Borrador', 'En cotización'].includes(request.status)) request.status = 'En evaluación'; const next = request.directDeal ? 'Trato directo' : 'Compra normal'; addAuditEvent({ action: `${request.directDeal ? 'activó' : 'desactivó'} trato directo`, object: id, previous, next, note: request.directDeal ? 'La condición permite una cotización y se registra para visado.' : '' }); showToast(request.directDeal ? 'Trato directo activado' : 'Trato directo desactivado', 'warning'); renderApp();
  }
  else if (action === 'approve-request') startApprove(id);
  else if (action === 'open-return') startDecision(id, 'devolver', openReturnModal);
  else if (action === 'open-reject') startDecision(id, 'rechazar', openRejectModal);
  else if (action === 'open-award-form') openAwardModal(id);
  else if (action === 'request-approval') {
    const request = getRequest(id); const previous = request.status; const tier = getTier(request.amount);
    request.status = 'En visado';
    state.approvals.push({ id: `APR-${String(state.approvals.length + 1).padStart(3, '0')}`, requestId: id, status: 'Pendiente', amount: request.amount, requiredRole: tier.approverRole, requestedBy: state.currentUser.name, requestedAt: todayISO(), decidedBy: null, decidedRole: null, decidedAt: null, note: '' });
    addAuditEvent({ action: 'solicitó visado', object: id, previous, next: request.status, note: `Tramo ${tierIndex(tier) + 1}: requiere ${tier.approverLabel}.` });
    showToast(`Visado solicitado: requiere ${tier.approverLabel}.`); navigate('solicitud', id, 'aprobaciones');
  } else if (action === 'open-attach-contract') openAttachContractModal(id);
  else if (action === 'attach-sample-contract') attachSignedContract(id, `Contrato_${getContract(id).id}_firmado_timbrado.pdf`);
  else if (action === 'close-contract') {
    if (!getContract(id)?.signedDoc) { closeModal(); showToast(CONTRACT_ATTACH_MESSAGE, 'error'); return; }
    if (element.dataset.confirmed) {
      const request = getRequest(id); const contract = getContract(id); const previous = request.status;
      request.status = 'Contrato cerrado'; contract.status = 'Cerrado'; contract.closedAt = todayISO(); contract.devengo = true;
      // Devengar no vuelve a descontar: el monto ya estaba comprometido desde la aprobación.
      postLedger({ type: 'Devengado', requestId: id, amount: contract.amount, description: `Cierre del contrato ${contract.id}` });
      addAuditEvent({ action: `cerró el contrato ${contract.id}`, object: id, previous, next: request.status });
      closeModal(); showToast('Contrato cerrado y devengado. El saldo comprometido no cambia.'); navigate('solicitud', id, 'presupuesto');
    } else confirmAction('Cerrar contrato', 'El contrato quedará cerrado, será solo lectura y generará devengo.', 'close-contract', id);
  } else if (action === 'execute-payment') {
    const request = getRequest(id); const contract = getContract(id);
    if (!contract?.devengo) { showToast('El contrato debe estar devengado primero', 'error'); return; }
    if (contract.paid) { showToast('El pago ya fue ejecutado', 'warning'); return; }
    contract.paid = true;
    // Ejecutar baja el saldo real; el comprometido ya se descontó en la aprobación y no se toca otra vez.
    postLedger({ type: 'Ejecutado', requestId: id, amount: contract.amount, description: `Pago del contrato ${contract.id}` });
    addAuditEvent({ action: 'marcó pago ejecutado', object: id, previous: 'Devengado', next: 'Ejecutado', note: `Contrato ${contract.id}` });
    showToast('Pago ejecutado: baja el saldo real; el saldo comprometido no se descuenta de nuevo.'); navigate('solicitud', id, 'presupuesto');
  } else if (action === 'open-budget-movement') openBudgetMovementModal(element.dataset.type);
  else if (action === 'open-document-form') openDocumentModal(id);
  else if (action === 'open-user-form') openUserModal();
  else if (action === 'deactivate-user') { const user = state.users.find((item) => item.id === id); openModal(`${formHeader('Desactivar usuario', `${user.name} dejará de aparecer en vistas operativas.`)}<form data-form="deactivate-user" data-user-id="${id}"><div class="modal-body"><label for="deactivate-reason">Motivo *</label><textarea id="deactivate-reason" name="reason" required placeholder="Explica por qué se desactiva el acceso"></textarea></div>${formFooter('Cancelar', 'Desactivar usuario')}</form>`); }
  else if (action === 'open-delegate') openDelegateModal(id);
  else if (action === 'open-reassign') openDelegateModal(id, true);
  else if (action === 'open-take-control') openTakeControlModal(id);
  else if (action === 'open-overdraft') { const request = getRequest(id); const account = computeAccount(request.year); openModal(`${formHeader('Solicitar autorización de sobregiro', 'La compra puede superar el saldo disponible con autorización expresa.')}<form data-form="overdraft" data-request-id="${id}"><div class="modal-body"><div class="callout warning">${icon('trending-down', 20)}<span>Saldo disponible: <strong>${formatCLP(account.saldoComprometido)}</strong> · Monto solicitado: <strong>${formatCLP(request.amount)}</strong> · Exceso: <strong>${formatCLP(Math.max(0, request.amount - account.saldoComprometido))}</strong></span></div><label for="overdraft-reason" style="margin-top:16px">Motivo *</label><textarea id="overdraft-reason" name="reason" required placeholder="Explica por qué se requiere la autorización"></textarea></div>${formFooter('Cancelar', 'Registrar autorización')}</form>`); }
  else if (action === 'change-detail-tab') navigate('solicitud', id, element.dataset.tab);
  else if (action === 'select-quote') {
    const request = getRequest(id); const quote = getQuotes(id).find((item) => item.id === element.dataset.quoteId);
    request.selectedQuoteId = quote.id;
    addAuditEvent({ action: `seleccionó la cotización de ${getProvider(quote.providerId)?.name}`, object: id, note: 'Quedará preseleccionada al adjudicar.' });
    showToast('Cotización seleccionada. Quedará preseleccionada al adjudicar.'); renderApp();
  }
  else if (action === 'clear-filters') { state.filters[element.dataset.scope] = {}; renderApp(); }
  else if (action === 'clear-dashboard-filters') { state.filters.dashboard = {}; renderApp(); }
  else if (action === 'export-audit') showToast(`Exportación ${element.dataset.format} simulada`);
}

document.addEventListener('click', (event) => {
  const blocked = event.target.closest('[data-blocked-reason]');
  if (blocked) { event.preventDefault(); showBlockedAction(blocked); return; }
  const routeTarget = event.target.closest('[data-route]');
  if (routeTarget && !event.target.closest('[data-action]')) { navigate(routeTarget.dataset.route, routeTarget.dataset.id || null, routeTarget.dataset.tab || null); document.querySelector('#sidebar').classList.remove('open'); return; }
  const actionTarget = event.target.closest('[data-action]');
  if (actionTarget && !actionTarget.disabled) handleAction(actionTarget.dataset.action, actionTarget);
  if (event.target.matches('[data-modal-backdrop]')) closeModal();
});

document.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target.closest('[data-form]');
  if (!form) return;
  if (form.dataset.form === 'deactivate-user') {
    const user = state.users.find((item) => item.id === form.dataset.userId); const previous = user.status; user.status = 'Inactivo'; addAuditEvent({ action: `desactivó al usuario ${user.name}`, object: user.id, previous, next: user.status, note: collectForm(form).reason }); closeModal();
    if (user.id === state.currentUser.id) { state.session.loggedIn = false; history.replaceState(null, '', '#dashboard'); renderApp(); showToast('Tu usuario fue dado de baja: se cerró la sesión.', 'warning'); return; }
    showToast('Usuario desactivado: ya no puede ingresar al sistema', 'warning'); renderApp(); return;
  }
  if (form.dataset.form === 'overdraft') {
    const request = getRequest(form.dataset.requestId); request.overBudget = true; addAuditEvent({ action: 'registró autorización de sobregiro', object: request.id, previous: 'Saldo insuficiente', next: 'Sobregiro autorizado', note: collectForm(form).reason }); closeModal(); showToast('Autorización de sobregiro registrada', 'warning'); renderApp(); return;
  }
  handleSubmit(form);
});

// Campos con texto obligatorio: un texto de solo espacios no cuenta como observación.
document.addEventListener('input', (event) => {
  const field = event.target;
  if (field.matches('[data-min-chars]')) {
    const min = Number(field.dataset.minChars);
    field.setCustomValidity(field.value.trim().length < min ? `Escribe al menos ${min} caracteres.` : '');
  }
  if (field.matches('[data-filter-scope]') && field.tagName === 'INPUT' && field.type === 'text') handleFilter(field);
  if (NEW_REQUEST_RULES[field.id] && field.hasAttribute('aria-invalid')) setFieldError(field, NEW_REQUEST_RULES[field.id](field.value, field));
  if (field.id === 'contract-file' && field.files?.length) setFieldError(field, '');
});
document.addEventListener('change', (event) => {
  if (event.target.matches('[data-role-select]')) { switchRole(event.target.value); return; }
  if (event.target.matches('[data-filter-scope]')) handleFilter(event.target);
  const field = event.target;
  if (NEW_REQUEST_RULES[field.id] && field.hasAttribute('aria-invalid')) setFieldError(field, NEW_REQUEST_RULES[field.id](field.value, field));
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { closeModal(); return; }
  if (event.key === 'Tab') {
    const modal = document.querySelector('.modal');
    if (!modal) return;
    const focusable = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
window.addEventListener('hashchange', renderApp);

renderApp();
