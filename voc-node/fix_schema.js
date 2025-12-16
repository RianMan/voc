import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. 定义纯净的内容 (不含任何隐藏字符)
const envContent = [
    'DEEPSEEK_API_KEY=sk-627a9',
    'DEEPSEEK_BASE_URL=https://api.deepseek.com',
    'TONGYI_API_KEY=sk-e76',
    'PORT=3000',
    'DATABASE_URL="mysql://root:password@127.0.0.1:3306/voc_db"'
].join('\n');

const schemaContent = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id           Int          @id @default(autoincrement())
  username     String       @unique
  passwordHash String
  displayName  String?
  role         String       @default("operator")
  isActive     Boolean      @default(true)
  createdAt    DateTime     @default(now())
  lastLogin    DateTime?
  statusLogs   StatusLog[]
  notes        ReviewNote[]
  createdTopics TopicConfig[]
}

model AppConfig {
  appId       String   @id
  appName     String
  country     String
  isActive    Boolean  @default(true)
  feedbacks   Feedback[]
}

model Feedback {
  id              String         @id @default(uuid())
  appId           String
  source          FeedbackSource
  externalId      String?
  originalTime    DateTime
  content         String         @db.Text
  metaData        Json?
  category        String?
  riskLevel       String?
  summary         String?        @db.VarChar(500)
  translatedText  String?        @db.Text
  rootCause       String?        @db.Text
  actionAdvice    String?        @db.Text
  suggestedReply  String?        @db.Text
  status          ReviewStatus   @default(PENDING)
  assigneeId      Int?
  statusNote      String?        @db.Text
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  app             AppConfig      @relation(fields: [appId], references: [appId])
  statusLogs      StatusLog[]
  notes           ReviewNote[]
  @@unique([source, externalId])
  @@index([appId, source, originalTime])
  @@index([category, riskLevel])
}

model TopicConfig {
  id           Int      @id @default(autoincrement())
  name         String
  keywords     Json
  scopeCountry String?
  scopeAppId   String?
  isActive     Boolean  @default(true)
  createdById  Int
  createdAt    DateTime @default(now())
  creator      User     @relation(fields: [createdById], references: [id])
}

model StatusLog {
  id         Int          @id @default(autoincrement())
  feedbackId String
  oldStatus  ReviewStatus?
  newStatus  ReviewStatus
  userId     Int?
  userName   String?
  note       String?
  createdAt  DateTime     @default(now())
  feedback   Feedback     @relation(fields: [feedbackId], references: [id])
  user       User?        @relation(fields: [userId], references: [id])
}

model ReviewNote {
  id         Int      @id @default(autoincrement())
  feedbackId String
  userId     Int
  userName   String?
  content    String   @db.Text
  createdAt  DateTime @default(now())
  feedback   Feedback @relation(fields: [feedbackId], references: [id])
  user       User     @relation(fields: [userId], references: [id])
}

model AiCost {
  id             Int      @id @default(autoincrement())
  provider       String
  model          String
  operationType  String
  inputTokens    Int
  outputTokens   Int
  totalCost      Float
  createdAt      DateTime @default(now())
}

enum FeedbackSource {
  GOOGLE_PLAY
  APP_STORE
  UDESK_CHAT
  CALL_TRANSCRIPT
  EMAIL
}

enum ReviewStatus {
  PENDING
  IRRELEVANT
  CONFIRMED
  REPORTED
  IN_PROGRESS
  RESOLVED
}
`;

console.log('🔄 开始清理和重置配置文件...');

// 2. 写入 .env
try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) fs.unlinkSync(envPath); // 先删除
    fs.writeFileSync(envPath, envContent, { encoding: 'utf8' });
    console.log('✅ .env 已重写');
} catch (e) {
    console.error('❌ .env 写入失败:', e.message);
}

// 3. 写入 schema.prisma
try {
    const schemaPath = path.join(__dirname, 'prisma/schema.prisma');
    if (fs.existsSync(schemaPath)) fs.unlinkSync(schemaPath); // 先删除
    fs.writeFileSync(schemaPath, schemaContent, { encoding: 'utf8' });
    console.log('✅ prisma/schema.prisma 已重写');
} catch (e) {
    console.error('❌ schema.prisma 写入失败:', e.message);
}

// 4. 清理 Prisma 缓存 (可选)
try {
    const prismaCache = path.join(__dirname, 'node_modules/.prisma');
    if (fs.existsSync(prismaCache)) {
        fs.rmSync(prismaCache, { recursive: true, force: true });
        console.log('✅ 已清理 node_modules/.prisma 缓存');
    }
} catch (e) {
    console.log('⚠️ 缓存清理跳过 (不影响)');
}

console.log('\n🎉 重置完成！请立即运行: npx prisma generate');