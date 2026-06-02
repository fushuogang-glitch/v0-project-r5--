import { redirect } from 'next/navigation'

// 自助注册已关闭:账号统一由中台/管理员开通,任何 /sign-up 访问一律转登录页
export default function SignUpPage() {
  redirect('/sign-in')
}
