import {
  Wallet,
  Landmark,
  Banknote,
  CreditCard,
  Gift,
  Smartphone,
  type LucideIcon,
} from 'lucide-react'

export const ACCOUNT_TYPE_META: Record<
  string,
  { label: string; icon: LucideIcon }
> = {
  wechat: { label: '微信', icon: Smartphone },
  alipay: { label: '支付宝', icon: Smartphone },
  bank: { label: '对公银行', icon: Landmark },
  cash: { label: '现金', icon: Banknote },
  pos: { label: 'POS 刷卡', icon: CreditCard },
  stored_value: { label: '会员储值', icon: Gift },
}

export function accountMeta(type: string) {
  return ACCOUNT_TYPE_META[type] ?? { label: type, icon: Wallet }
}
