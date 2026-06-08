## Correções na tela de celular

### 1. Botão "Área do Administrador" some no celular
Em `src/routes/index.tsx` (linha 123-128), o link tem as classes `hidden ... sm:inline-flex`, escondendo no mobile.

**Correção:** remover o `hidden`/`sm:inline-flex` e mostrar uma versão compacta no celular — ícone de escudo (`ShieldCheck` do lucide-react) com tooltip/aria-label, mantendo o texto completo "Área do Administrador" em telas ≥ sm.

### 2. Pop-up de cadastro/edição de produto estoura no celular
Em `src/routes/admin.tsx` (linhas 435-517, componente `ProductForm`), o `<form>` não tem altura máxima nem rolagem própria, então em telas baixas os campos do fim (e o topo, como a foto) ficam offscreen sem possibilidade de scroll dentro do modal.

**Correções no container do modal:**
- Container externo: usar `items-stretch sm:items-center` e altura controlada para permitir scroll.
- Form: aplicar `max-h-[100dvh] sm:max-h-[90vh]` e `flex flex-col` para que o cabeçalho/rodapé fiquem fixos.
- Envolver o miolo (`grid gap-4 ...`) em um wrapper com `flex-1 overflow-y-auto -mx-6 px-6` para rolar somente os campos, mantendo título e botões "Cancelar/Salvar" visíveis.
- Adicionar um pequeno padding-bottom seguro (`pb-[env(safe-area-inset-bottom)]`) no celular.

Nenhuma mudança de lógica/CRUD — apenas presentation/CSS.
