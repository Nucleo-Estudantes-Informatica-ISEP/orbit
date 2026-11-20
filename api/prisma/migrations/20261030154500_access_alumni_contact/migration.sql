-- Restore the unchanged legacy manual Alumni contact step, including without a link.
-- Fresh seeds already create it enabled. Preserve configured resources and later
-- administrator choices; do not modify policies, custom resources or snapshots.
UPDATE "AccessResource"
SET "enabled" = true, "automatic" = false,
    "instructions" = 'Na transição Alumni, manter contacto no WhatsApp: convidar/adicionar o número ao grupo Alumínios e confirmar adesão. Se faltar link, contactar o administrador do grupo; o passo continua manual e visível. Só remover este contacto num pedido explícito aprovado.',
    "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'f3e655c1-ed39-4046-a922-f11b71462c62'
  AND "version" = 1 AND "remoteId" = 'CONFIGURE_ME' AND "enabled" = false;
