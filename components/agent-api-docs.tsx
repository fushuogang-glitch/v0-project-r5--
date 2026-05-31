import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Endpoint = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  desc: string
  sample: string
}

const METHOD_STYLE: Record<Endpoint['method'], string> = {
  GET: 'border-sky-200 bg-sky-50 text-sky-700',
  POST: 'border-amber-200 bg-amber-50 text-amber-700',
  PATCH: 'border-violet-200 bg-violet-50 text-violet-700',
  DELETE: 'border-rose-200 bg-rose-50 text-rose-700',
}

const ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/agent/entities',
    desc: '抓取集团旗下所有门店主体及税政口径',
    sample: `curl -H "Authorization: Bearer agt_xxx" \\
  {BASE}/api/agent/entities`,
  },
  {
    method: 'GET',
    path: '/api/agent/entities/:id',
    desc: '抓取某门店的流水、记账凭证、利润表与资产负债表',
    sample: `curl -H "Authorization: Bearer agt_xxx" \\
  {BASE}/api/agent/entities/3`,
  },
  {
    method: 'POST',
    path: '/api/agent/entities/:id',
    desc: '回填一笔流水,系统按主体税政自动价税分离并计税',
    sample: `curl -X POST {BASE}/api/agent/entities/3 \\
  -H "Authorization: Bearer agt_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "bizType": "expense",
    "bizDate": "2026-05-31",
    "category": "房租物业",
    "channel": "银行卡",
    "amount": 12000,
    "invoiceMedium": "electronic",
    "invoiceKind": "special",
    "summary": "5月门店租金"
  }'`,
  },
]

// 人力组织 Agent:调整人员 + 录入工资
const HR_ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/agent/org',
    desc: '拉取组织字典:中控部门、门店岗位、门店主体、职级表(用于拿到正确的 id)',
    sample: `curl -H "Authorization: Bearer agt_xxx" \\
  {BASE}/api/agent/org`,
  },
  {
    method: 'GET',
    path: '/api/agent/employees',
    desc: '列出员工,支持 ?entityId= / ?level=group|entity / ?status=active|left 筛选',
    sample: `curl -H "Authorization: Bearer agt_xxx" \\
  "{BASE}/api/agent/employees?entityId=3&status=active"`,
  },
  {
    method: 'POST',
    path: '/api/agent/employees',
    desc: '新增员工。门店层需 entityId,集团层需 departmentId;jobLevel 取 L1-L15',
    sample: `curl -X POST {BASE}/api/agent/employees \\
  -H "Authorization: Bearer agt_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "level": "entity",
    "entityId": 3,
    "name": "张敏",
    "position": "美容师",
    "jobLevel": "L4",
    "hireDate": "2026-05-01"
  }'`,
  },
  {
    method: 'PATCH',
    path: '/api/agent/employees/:id',
    desc: '调整员工:岗位、职级、转部门/转店、上级、电话、离职状态(任意字段可选)',
    sample: `curl -X PATCH {BASE}/api/agent/employees/12 \\
  -H "Authorization: Bearer agt_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{ "position": "店长", "jobLevel": "L8" }'`,
  },
  {
    method: 'DELETE',
    path: '/api/agent/employees/:id',
    desc: '员工离职(默认软删除置 status=left;加 ?hard=true 物理删除)',
    sample: `curl -X DELETE {BASE}/api/agent/employees/12 \\
  -H "Authorization: Bearer agt_xxx"`,
  },
  {
    method: 'GET',
    path: '/api/agent/salaries',
    desc: '查询某员工某年逐月工资明细 + 年度汇总。?employeeId= 必选,?year= 默认当年',
    sample: `curl -H "Authorization: Bearer agt_xxx" \\
  "{BASE}/api/agent/salaries?employeeId=12&year=2026"`,
  },
  {
    method: 'POST',
    path: '/api/agent/salaries',
    desc: '录入/覆盖某员工某月工资(同员工同月唯一)。netPay 缺省=基本+提成+补贴-扣款',
    sample: `curl -X POST {BASE}/api/agent/salaries \\
  -H "Authorization: Bearer agt_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "employeeId": 12,
    "year": 2026,
    "month": 5,
    "baseSalary": 4000,
    "commission": 2500,
    "allowance": 300,
    "deduction": 200
  }'`,
  },
]

export function AgentApiDocs() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">接口说明</CardTitle>
        <CardDescription>
          鉴权方式:请求头携带 Authorization: Bearer &lt;密钥&gt; 或 x-agent-key: &lt;密钥&gt;
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <EndpointGroup title="财务 Agent · 门店数据与流水回填" endpoints={ENDPOINTS} />
        <EndpointGroup title="人力组织 Agent · 人员调整与工资录入" endpoints={HR_ENDPOINTS} />
      </CardContent>
    </Card>
  )
}

function EndpointGroup({ title, endpoints }: { title: string; endpoints: Endpoint[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {endpoints.map((ep) => (
        <div key={ep.method + ep.path} className="rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className={METHOD_STYLE[ep.method]}>
              {ep.method}
            </Badge>
            <code className="font-mono text-sm text-foreground">{ep.path}</code>
          </div>
          <p className="mb-2 text-sm text-muted-foreground">{ep.desc}</p>
          <pre className="overflow-x-auto rounded-md bg-muted/60 p-3 text-xs leading-relaxed text-foreground">
            <code>{ep.sample}</code>
          </pre>
        </div>
      ))}
    </div>
  )
}
