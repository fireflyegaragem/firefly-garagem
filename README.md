# 🏎️ Mini Garagem CMS

Sistema completo de gerenciamento de catálogo para a Mini Garagem Colecionáveis.
O catálogo frontend é **totalmente integrado** com a API — produtos, banner e configurações são carregados dinamicamente.

---

## 🚀 Como rodar

### 1. Instalar dependências

```bash
cd backend
npm install
```

### 2. Iniciar o servidor

```bash
npm start
```

O servidor sobe em **http://localhost:3001**

---

## 🔗 URLs

| URL | Descrição |
|-----|-----------|
| `http://localhost:3001` | **Catálogo público** (integrado com a API) |
| `http://localhost:3001/admin` | **Painel Administrativo** |
| `http://localhost:3001/api/products` | API pública de produtos |
| `http://localhost:3001/api/settings` | API pública de configurações |

---

## 🔐 Login padrão

| Campo | Valor |
|-------|-------|
| Usuário | `admin` |
| Senha | `admin123` |

> Troque a senha após o primeiro acesso em **Conta → Alterar Senha**

---

## 📦 Estrutura do projeto

```
mini-garagem-cms/
├── start.sh                   # Script de inicialização (Linux/Mac)
├── README.md
├── backend/
│   ├── server.js              # Servidor Express principal
│   ├── package.json
│   ├── data/
│   │   └── db.json            # Banco de dados JSON (produtos, settings, admin)
│   └── uploads/               # Imagens enviadas pelo admin (criado automaticamente)
└── frontend/
    ├── index.html             # Catálogo público — integrado com a API
    └── admin/
        └── index.html         # Painel administrativo
```

---

## Como funciona a integração

Ao abrir http://localhost:3001, o catálogo:

1. Busca as configurações (GET /api/settings) → aplica banner, WhatsApp, nome da loja
2. Busca os produtos (GET /api/products) → renderiza os cards dinamicamente
3. Preenche os filtros de Marcas e Modelos com os dados reais do catálogo
4. Em caso de API offline, exibe automaticamente um catálogo estático de fallback

Qualquer alteração feita no painel admin é refletida imediatamente ao recarregar o catálogo.

---

## Campos de produto

- name: Nome do produto (obrigatório)
- brand: Marca — Hot Wheels, MiniGT, Matchbox... (obrigatório)
- model: Categoria — Ferrari, F1, Nacionais...
- scale: Escala — 1/64, 1/43, 1/24...
- price: Preço em R$ (obrigatório)
- stock: Quantidade em estoque
- badge: Tag — Destaque, Premium, F1, Brasil, Raros, Novo
- description: Descrição livre
- img / image: URL externa ou upload de arquivo (JPEG, PNG, WebP, até 5MB)

---

## Variáveis de ambiente

PORT=3001
JWT_SECRET=mini-garagem-secret-2024   # troque em produção!

---

## Deploy rápido

Railway / Render: sobe o repositório, define PORT e JWT_SECRET, pronto.
VPS: pm2 start backend/server.js --name mini-garagem
