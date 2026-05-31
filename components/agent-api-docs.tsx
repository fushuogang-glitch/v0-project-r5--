import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Endpoint = {
  method: 'GET' | 'POST'
  path: string
  desc: string
  sample: string
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

export function AgentApiDocs() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">接口说明</CardTitle>
        <CardDescription>
          鉴权方式:请求头携带 Authorization: Bearer &lt;密钥&gt; 或 x-agent-key: &lt;密钥&gt;
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {ENDPOINTS.map((ep) => (
          <div key={ep.method + ep.path} className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  ep.method === 'GET'
                    ? 'border-sky-200 bg-sky-50 text-sky-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }
              >
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
      </CardContent>
    </Card>
  )
}
