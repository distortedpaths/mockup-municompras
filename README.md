# Prototipo de gestión de compras — Municipalidad de Santiago

Mockup navegable para validar con el cliente el flujo de solicitudes, cotizaciones, visado por tramos, adjudicación, contratos y presupuesto. Todos los datos son de ejemplo, viven en memoria y vuelven al estado inicial al recargar.

## Cómo abrirlo

Abre `index.html` en un navegador moderno (no requiere instalación ni backend). Al entrar elige un perfil; luego puedes cambiar de rol desde el selector **Rol activo** de la barra superior.

## Archivos

- `index.html`, `styles.css`, `app.js`: el prototipo.
- `logo.svg`: vectorización del logo entregado (colores medidos del original). Para usar la imagen oficial cambia la constante `LOGO_SRC` al inicio de `app.js`.
- `fonts/` y `vendor/`: fuentes (Manrope, IBM Plex Mono) e íconos (lucide) locales. **Funciona sin internet.**

## Qué se configura y dónde

| Qué | Dónde |
| --- | --- |
| Tramos de visado y aprobador de cada tramo | constante `APPROVAL_TIERS`, inicio de `app.js` |
| Logo | constante `LOGO_SRC` (si queda vacía se muestra el texto "Municipalidad de Santiago") |
| Colores | variables `--color-primario`, `--color-secundario`, `--color-acento`, `--color-fondo`, `--color-texto` en `:root` de `styles.css` |
| Accesos por rol | `ROUTE_ACCESS` y `PERMISSIONS` en `app.js` |

**Los colores son provisorios**: azul `#022873`, gris `#585757` y amarillo `#FAB800` se midieron del logo entregado; fondo y texto son valores propuestos. Reemplazarlos por los hexadecimales del manual de identidad oficial.

## Roles

Solicitante · Comprador · Supervisor · Jefatura · **Superusuario de visado** (máxima jerarquía) · Administrador técnico · **Pasante** (solo consulta y carga de documentos). Cada rol ve solo su menú y sus acciones. Las acciones que un rol no puede hacer se ven **bloqueadas** con el motivo (p. ej. "Requiere visado de Jefatura" o "Tu rol (Pasante) solo permite consulta y carga de documentos").

## Visado por tramos (P-06)

| Monto de la compra | Aprobador |
| --- | --- |
| Hasta $10.000.000 | Supervisor habilitado |
| $10.000.001 a $20.000.000 | Jefatura |
| Sobre $20.000.000 | Superusuario de visado |

Cada rol visa su tramo y los inferiores. Un rol sin atribución ve el bloqueo ("Esta compra requiere visado del Superusuario") y la acción no se ejecuta. Devolver o rechazar exige observación (mín. 10 caracteres). Aprobar pide confirmación con monto, proveedor y efecto sobre el fondo. Los visados quedan en una línea de tiempo (quién, rol, fecha).

## Presupuesto (P-02)

Una sola pantalla con fondo asignado, **saldo real** (descuenta lo ejecutado) y **saldo comprometido** (descuenta lo aprobado y devengado, neto de anulaciones). Todo se calcula desde los movimientos (Asignación, Aprobado, Devengado, Ejecutado, Anulado):

- Aprobar baja el comprometido **una sola vez**.
- Devengar (cerrar contrato) no cambia ningún saldo.
- Ejecutar el pago baja solo el saldo real; no vuelve a descontar lo comprometido.
- Si se adjudica por menos del monto visado, la diferencia se libera (movimiento Anulado).

Filtros: año, responsable, departamento, estado, proveedor y fechas.

## Cierre de contrato (P-08)

Para cerrar un contrato hay que **adjuntar el contrato firmado y timbrado** (archivo o "archivo de ejemplo"). Sin adjunto, "Cerrar contrato" queda bloqueado con el mensaje "Adjunta el contrato firmado y timbrado para cerrar". El adjunto queda en Documentos y en el historial.

## Renovación de equipos (P-11)

Equipos con categoría A/B/C (categorías de ejemplo), fecha de inicio, antigüedad e indicador "3 años cumplidos". La antigüedad se calcula con la fecha de hoy.

## Estados

Los estados usan la palabra "visado": *En visado* y *Visada* (el menú dice "Visado").

## Empate de puntaje (P-05)

Puntaje = 50% valor económico + 25% calidad técnica + 25% entrega. Si dos cotizaciones empatan en el primer lugar, se muestra "Empate de puntaje: decide el aprobador" y **Adjudicar** queda bloqueado hasta que el aprobador que corresponde por monto elija una cotización y escriba una justificación; la decisión queda en el historial. Ejemplo: `SOL-2026-015`.

## Fondos insuficientes (P-12)

Al aprobar una compra mayor al saldo comprometido, el visado se rechaza y se muestra el saldo disponible, el monto solicitado y el faltante. Ejemplo: `SOL-2026-017`. Desde ahí se puede solicitar autorización de sobregiro.

## Casos de ejemplo

| Solicitud | Monto | Para probar |
| --- | --- | --- |
| SOL-2026-013 | $7.800.000 | Visado del Supervisor |
| SOL-2026-014 | $12.500.000 | Visado de Jefatura (caso principal, ya fue devuelta una vez) |
| SOL-2026-015 | $16.800.000 | Empate de puntaje, ya visada |
| SOL-2026-016 | $24.500.000 | Bloqueo a Jefatura; solo el Superusuario puede visar |
| SOL-2026-017 | $75.000.000 | Rechazo por fondos insuficientes (P-12) |

## Fuera de alcance

ChileCompra, Compra Ágil, Convenio Marco, Mercado Público, órdenes de compra, facturación real, pagos automáticos, autenticación real, persistencia, backend, ampliaciones o prórrogas de contratos cerrados.
