# João Arthur — finanças

Site pessoal de finanças, feito para funcionar como um site estático no GitHub Pages.

## Arquivos

- `index.html` — estrutura da página.
- `style.css` — visual minimalista.
- `app.js` — funcionamento, senha, registros, pagamentos, histórico e backup.

## Importante

Esta versão não usa servidor nem API. Isso permite hospedagem 100% gratuita no GitHub Pages.

Os registros são salvos no `localStorage` do navegador. Isso significa que:

- os dados ficam naquele navegador/dispositivo;
- limpar os dados do navegador pode apagar os registros;
- abrir o site em outro celular/computador não mostra automaticamente os mesmos registros;
- use o botão "Exportar backup" para guardar uma cópia.

A senha também é apenas uma barreira de interface. Como o GitHub Pages entrega o JavaScript ao navegador, alguém com conhecimento técnico pode encontrar a senha no código. Não use esta versão para proteger informações que precisem de segurança real.

## Interpretação de texto

O site possui um interpretador local de frases em português. Ele entende formatos como:

- "Estou devendo R$ 100 para minha mãe porque peguei dinheiro emprestado."
- "Devo 50 reais para João."
- "João me deve R$ 80."
- "Minha mãe me deve 100 reais."

Não é um modelo de IA generativa. Ele funciona por regras para permanecer 100% gratuito e sem expor uma chave de API.

## GitHub Pages

Depois de colocar estes arquivos em um repositório, ative GitHub Pages em:

Settings → Pages → Build and deployment → Deploy from a branch → `main` → `/ (root)` → Save.

O arquivo de entrada é `index.html`.
