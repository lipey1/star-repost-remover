# Star Repost Remover

## Resumo
Gerencie e remova seus republicados do Instagram com acompanhamento de progresso e console de eventos.

## Descrição
Star Repost Remover é uma ferramenta independente para ajudar você a limpar seus republicados no Instagram pelo navegador.

Abra Sua atividade → Interações → Reposts para acessar o painel. A execução começa somente após você clicar em Iniciar remoção.

- Modo individual: percorre os vídeos, tenta a remoção individual pela API usada pela página e usa o botão nativo quando os dados necessários não estão disponíveis.
- Modo de lotes de 100: seleciona itens com rolagem automática e aciona o fluxo nativo de exclusão em lote. A extensão não confirma a persistência desse fluxo e encerra após um lote.
- Console com eventos, horários, erros e pausas por limitação de requisições.
- Uma remoção individual por vez. Em rate limit explícito, aguarda pelo menos 30 segundos, respeitando Retry-After maior.
- Botão Parar e limpeza dos logs ao iniciar uma nova execução.

Versão inicial. O Instagram pode alterar sua interface, restringir chamadas ou informar resultados que ainda não foram persistidos. A remoção individual observa a resposta da chamada; quando usa a API direta, consulta novamente os dados do post para verificar o resultado. Itens com erro podem ser ignorados e permanecer na conta. A execução completa em diferentes contas ainda não foi validada.

Não exclui os posts originais. Atua sobre republicações da sua conta. Não é afiliada, patrocinada ou aprovada pelo Instagram ou pela Meta.

## Finalidade única
Ajudar o usuário a remover seus próprios republicados do Instagram, com controle manual de início/parada e acompanhamento da execução.

## Acesso solicitado
Os scripts atuam em instagram.com para observar a chamada individual de remoção e obter os dados necessários durante a navegação. O painel é carregado somente na página de atividade de republicados. O acesso não é usado para análise de navegação, publicidade ou serviços externos.

## Dados tratados
Informações da sessão e cabeçalhos usados pela chamada do Instagram são processados em memória para repetir a operação autenticada dentro do próprio Instagram. IDs de repost, mídia e usuário são usados somente para identificar o item a remover. O último erro é mantido em sessionStorage da aba; os eventos do console ficam em memória, com limite de 200 entradas. Não há servidor próprio, telemetria, publicidade ou venda de dados.

## Antes de enviar
- Hospedar PRIVACY.md em uma URL pública e preencher essa URL no painel da loja.
- Informar os dados reais do responsável e um canal de suporte.
- Preencher as declarações de privacidade de forma compatível com o tratamento de sessão e conteúdo descrito acima; não declarar que a extensão não acessa dados.
- Usar captura real do painel em funcionamento. A prévia local contém dados fictícios e não comprova a execução.
- Revisar os testes da versão antes de publicar para todos os usuários.
