# UTLC FFD System v2.0
**United Thai Logistics Company Limited — Freight Forwarder Document System**

## ภาพรวมระบบ
ระบบ FFD ใหม่ พัฒนาบน **Next.js 14 + TypeScript + Prisma + PostgreSQL** รันบน **Azure Container Apps**

## Modules
| Module | รายละเอียด |
|---|---|
| Job Management | Create/manage Import & Export jobs พร้อม containers |
| Cash Advance | ขอ / อนุมัติ / Clearing เงินสดทดรอง per job |
| Billing AR | Draft → Issue → Invoice → OIC batch |
| Billing AP | Payment Request → Approve → OIC batch |
| OIC Interface | Generate AR/AP batch file ส่ง Oracle Fusion รายวัน |
| Document Gen | Arrival Notice, Packing List, Invoice (DOCX) |
| Master Data | Customer, Vendor, Port, Charge Code + GL Account |
| Reports | Monthly P&L, Top Customers, Jobs by Type/Mode |

## User Roles
| Role | สิทธิ์ |
|---|---|
| CS | Create/edit jobs, invoices & payment requests |
| FINANCE | + Generate OIC batch |
| MANAGER | + Approve cash advances & payment requests |
| ADMIN | Full access including master data |

## Architecture
```
Yeeflow CRM  ──webhook──►  FFD (Next.js)  ──batch──►  OIC  ──►  Oracle Fusion
                                  │
                          Azure PostgreSQL
                          Azure Blob Storage
                          Azure AD SSO
```

## Yeeflow Webhook
```
POST https://ffd.utlc.co.th/api/webhooks/yeeflow
Header: x-webhook-secret: [YEEFLOW_WEBHOOK_SECRET]

{
  "event": "contract.awarded",
  "contract_no": "UTL-2504-0001",
  "customer_code": "CUST001",
  "type": "IMPORT",
  "mode": "SEA",
  "origin_port_code": "CNSHA",
  "dest_port_code": "THLCH"
}
```

## OIC Batch Format (pipe-delimited)
```
HEADER|AR_BATCH|20250418|UTLC|5
LINE|INV25040001|CUST001|41001|20250418|150000.00|0.00|THB|2025-04|Ocean Freight Import
FOOTER|5|760000.00
```

## Local Setup
```bash
npm install
cp .env.example .env   # กรอกค่าจริง
npm run db:migrate
npm run db:seed
npm run dev
```

## Job Number Format
- Import: IMP2504-001 | Export: EXP2504-001
- Invoice: INV25040001 | PR: PR25040001

## API Endpoints
| Method | Path | Description |
|---|---|---|
| POST | /api/webhooks/yeeflow | Receive contract |
| GET/POST | /api/jobs | Jobs list / create |
| GET/PATCH | /api/jobs/:id | Job detail / update |
| GET/POST | /api/cash-advances | Cash advances |
| POST | /api/cash-advances/:id | approve/clear/cancel |
| GET/POST | /api/payment-requests | AP requests |
| POST | /api/payment-requests/:id | submit/approve/paid |
| GET/POST | /api/invoices | AR invoices |
| POST | /api/invoices/:id | issue/mark_paid |
| GET/POST | /api/oic/batch | OIC batches |
| POST | /api/documents | Generate DOCX |
