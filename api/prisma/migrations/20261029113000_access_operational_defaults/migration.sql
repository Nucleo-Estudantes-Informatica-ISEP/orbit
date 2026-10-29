-- One-time correction of stock resources; policies, custom resources and approval snapshots are preserved.
UPDATE "AccessResource"
SET "automatic" = true, "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
WHERE "enabled" = true AND "automatic" = false AND "remoteId" <> 'CONFIGURE_ME'
  AND "id" IN (
    'a8b1a10f-49a5-47a3-aa55-731d2cb3088f',
    '5b08139b-9c69-4e69-aa54-649bf3539cbc',
    '1948a016-81f2-408e-a6cb-0ffe91601769',
    'c16de9e7-6933-4956-a119-c23be1f5fcea',
    '91091a77-0190-4465-ad84-2f5cd81ab626');

-- Stock manual steps stay visible before administrative links/destinations are available.
UPDATE "AccessResource"
SET "enabled" = true, "automatic" = false, "instructions" = 'No Coda, abrir a gestão de membros da team de Relações Externas e convidar o email indicado. Registar envio como aguarda conta e confirmar aceitação antes de concluir. Na saída remover e confirmar. Sem link administrativo, contactar o responsável de Relações Externas.',
    "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'd6bb447f-9fe5-4bcd-afdb-5b8654948251' AND "version" = 1 AND "remoteId" = 'CONFIGURE_ME' AND "enabled" = false;

UPDATE "AccessResource"
SET "enabled" = true, "automatic" = false, "instructions" = 'No Freedcamp, abrir a gestão de membros da team de Marketing e convidar o email indicado. Registar envio como aguarda conta e confirmar aceitação antes de concluir. Na saída remover e confirmar. Sem link administrativo, contactar o responsável de Marketing.',
    "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = '653a48cc-0460-4908-ab5a-7f7a70eba1c1' AND "version" = 1 AND "remoteId" = 'CONFIGURE_ME' AND "enabled" = false;

UPDATE "AccessResource"
SET "enabled" = true, "automatic" = false, "instructions" = 'Mediante pedido explícito aprovado, no cPanel > Contas de email criar/atualizar o endereço NEI indicado. Enviar instruções por canal privado. Na saída suspender login e envio/receção conforme decisão; preservar o conteúdo. Registar evidência sem passwords ou tokens.',
    "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = '6ae035c3-a23a-49b6-a924-7c64d16e9933' AND "version" = 1 AND "remoteId" = 'CONFIGURE_ME' AND "enabled" = false;

UPDATE "AccessResource"
SET "enabled" = true, "automatic" = true, "instructions" = 'Configurar a pasta da Presidência e partilhá-la com a service account. Até existir destino, um responsável da Presidência deve adicionar/remover o email Google na pasta e registar confirmação. Após configuração, Orbit gere a permissão automaticamente.',
    "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'ff615842-d525-43b0-a7b7-48d7c175ba1d' AND "version" = 1 AND "remoteId" = 'CONFIGURE_ME' AND "enabled" = false;

