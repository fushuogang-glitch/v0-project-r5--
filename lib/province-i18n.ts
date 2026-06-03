// 省级行政区中英文名映射(匹配 public/geo/china-provinces.json 的 name 字段)
// 用于中台地图脉冲点的双语标注
export const PROVINCE_EN: Record<string, string> = {
  北京市: 'Beijing',
  天津市: 'Tianjin',
  河北省: 'Hebei',
  山西省: 'Shanxi',
  内蒙古自治区: 'Inner Mongolia',
  辽宁省: 'Liaoning',
  吉林省: 'Jilin',
  黑龙江省: 'Heilongjiang',
  上海市: 'Shanghai',
  江苏省: 'Jiangsu',
  浙江省: 'Zhejiang',
  安徽省: 'Anhui',
  福建省: 'Fujian',
  江西省: 'Jiangxi',
  山东省: 'Shandong',
  河南省: 'Henan',
  湖北省: 'Hubei',
  湖南省: 'Hunan',
  广东省: 'Guangdong',
  广西壮族自治区: 'Guangxi',
  海南省: 'Hainan',
  重庆市: 'Chongqing',
  四川省: 'Sichuan',
  贵州省: 'Guizhou',
  云南省: 'Yunnan',
  西藏自治区: 'Tibet',
  陕西省: 'Shaanxi',
  甘肃省: 'Gansu',
  青海省: 'Qinghai',
  宁夏回族自治区: 'Ningxia',
  新疆维吾尔自治区: 'Xinjiang',
  台湾省: 'Taiwan',
  香港特别行政区: 'Hong Kong',
  澳门特别行政区: 'Macao',
}

/** 把数据库里存的省份(可能是简称或全称)归一化为 geo 的全称 key */
const ALIAS: Record<string, string> = {
  北京: '北京市',
  天津: '天津市',
  河北: '河北省',
  山西: '山西省',
  内蒙古: '内蒙古自治区',
  辽宁: '辽宁省',
  吉林: '吉林省',
  黑龙江: '黑龙江省',
  上海: '上海市',
  江苏: '江苏省',
  浙江: '浙江省',
  安徽: '安徽省',
  福建: '福建省',
  江西: '江西省',
  山东: '山东省',
  河南: '河南省',
  湖北: '湖北省',
  湖南: '湖南省',
  广东: '广东省',
  广西: '广西壮族自治区',
  海南: '海南省',
  重庆: '重庆市',
  四川: '四川省',
  贵州: '贵州省',
  云南: '云南省',
  西藏: '西藏自治区',
  陕西: '陕西省',
  甘肃: '甘肃省',
  青海: '青海省',
  宁夏: '宁夏回族自治区',
  新疆: '新疆维吾尔自治区',
  台湾: '台湾省',
  香港: '香港特别行政区',
  澳门: '澳门特别行政区',
}

/** 归一化为 geo 全称;无法识别时原样返回 */
export function normalizeProvince(name: string | null | undefined): string {
  if (!name) return ''
  const t = name.trim()
  if (PROVINCE_EN[t]) return t
  return ALIAS[t] ?? t
}

/** 取省份英文名 */
export function provinceEn(name: string | null | undefined): string {
  const full = normalizeProvince(name)
  return PROVINCE_EN[full] ?? ''
}

/** 供下拉选择用的省份全称列表 */
export const PROVINCE_LIST = Object.keys(PROVINCE_EN)
