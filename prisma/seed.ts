import { PrismaClient, ChargeType, VatType, PortType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding UTLC FFD database...')

  // Ports
  const ports = [
    { code: 'THBKK', name: 'Bangkok Port', country: 'TH', type: PortType.SEA },
    { code: 'THLCH', name: 'Laem Chabang Port', country: 'TH', type: PortType.SEA },
    { code: 'THBKK_AIR', name: 'Suvarnabhumi Airport', country: 'TH', type: PortType.AIR },
    { code: 'THDMK', name: 'Don Mueang Airport', country: 'TH', type: PortType.AIR },
    { code: 'SGSIN', name: 'Port of Singapore', country: 'SG', type: PortType.SEA },
    { code: 'MYPKG', name: 'Port Klang', country: 'MY', type: PortType.SEA },
    { code: 'CNSHA', name: 'Port of Shanghai', country: 'CN', type: PortType.SEA },
    { code: 'CNSHK', name: 'Port of Shekou', country: 'CN', type: PortType.SEA },
    { code: 'JPOSA', name: 'Port of Osaka', country: 'JP', type: PortType.SEA },
    { code: 'USLAX', name: 'Port of Los Angeles', country: 'US', type: PortType.SEA },
    { code: 'NLRTM', name: 'Port of Rotterdam', country: 'NL', type: PortType.SEA },
    { code: 'HKHKG', name: 'Hong Kong Port', country: 'HK', type: PortType.SEA },
  ]
  for (const p of ports) {
    await prisma.port.upsert({ where: { code: p.code }, update: {}, create: p })
  }

  // Charge codes
  const chargeCodes = [
    // Revenue
    { code: 'OFR_IMP', name: 'Ocean Freight Import', type: ChargeType.REVENUE, glAccount: '41001', vatType: VatType.ZERO },
    { code: 'OFR_EXP', name: 'Ocean Freight Export', type: ChargeType.REVENUE, glAccount: '41002', vatType: VatType.ZERO },
    { code: 'AFR_IMP', name: 'Air Freight Import', type: ChargeType.REVENUE, glAccount: '41003', vatType: VatType.ZERO },
    { code: 'AFR_EXP', name: 'Air Freight Export', type: ChargeType.REVENUE, glAccount: '41004', vatType: VatType.ZERO },
    { code: 'CUSTOMS', name: 'Customs Clearance', type: ChargeType.REVENUE, glAccount: '41010', vatType: VatType.SEVEN },
    { code: 'DOC_FEE', name: 'Documentation Fee', type: ChargeType.REVENUE, glAccount: '41011', vatType: VatType.SEVEN },
    { code: 'HANDLING', name: 'Handling Fee', type: ChargeType.REVENUE, glAccount: '41012', vatType: VatType.SEVEN },
    { code: 'DELIVERY', name: 'Local Delivery', type: ChargeType.REVENUE, glAccount: '41013', vatType: VatType.SEVEN },
    { code: 'THC_REV', name: 'Terminal Handling Charge', type: ChargeType.REVENUE, glAccount: '41014', vatType: VatType.ZERO },
    { code: 'B_L_FEE', name: 'B/L Fee', type: ChargeType.REVENUE, glAccount: '41015', vatType: VatType.SEVEN },
    // Cost
    { code: 'OFR_COST', name: 'Ocean Freight Cost', type: ChargeType.COST, glAccount: '51001', vatType: VatType.ZERO },
    { code: 'AFR_COST', name: 'Air Freight Cost', type: ChargeType.COST, glAccount: '51002', vatType: VatType.ZERO },
    { code: 'THC_COST', name: 'THC Cost', type: ChargeType.COST, glAccount: '51003', vatType: VatType.ZERO },
    { code: 'CUSTOMS_DUTY', name: 'Customs Duty', type: ChargeType.COST, glAccount: '51010', vatType: VatType.EXEMPT },
    { code: 'TRUCKING', name: 'Trucking Cost', type: ChargeType.COST, glAccount: '51011', vatType: VatType.SEVEN },
    { code: 'STORAGE', name: 'Storage/Demurrage', type: ChargeType.COST, glAccount: '51012', vatType: VatType.SEVEN },
    { code: 'AGENCY_FEE', name: 'Agency Fee', type: ChargeType.COST, glAccount: '51013', vatType: VatType.SEVEN },
  ]
  for (const c of chargeCodes) {
    await prisma.chargeCode.upsert({ where: { code: c.code }, update: {}, create: c })
  }

  console.log('Seed complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
