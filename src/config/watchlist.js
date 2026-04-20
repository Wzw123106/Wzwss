/**
 * 自选列表（与截图一致）：场外基金用 6 位基金代码走天天基金估值接口；
 * 如需改为场内 LOF 实时盘口，可把该项改为 { kind: "listed", secid: "0.161226" }。
 */
export const WATCHLIST = [
  { id: "003383", name: "民生加银鑫享债券C", kind: "otc" },
  { id: "021674", name: "国泰黄金股ETF联接C", kind: "otc" },
  { id: "007606", name: "嘉实沪深300红利低波动ETF联接C", kind: "otc" },
  { id: "016708", name: "华夏有色金属ETF联接C", kind: "otc" },
  { id: "001665", name: "平安鑫安混合C", kind: "otc" },
  { id: "016874", name: "广发远见智选混合C", kind: "otc" },
  { id: "018957", name: "中航机遇领航混合C", kind: "otc" },
  { id: "015790", name: "永赢高端装备智选混合C", kind: "otc" },
  { id: "290014", name: "泰信现代服务业混合", kind: "otc" },
  /**
   * C 类份额 fundgz 常无估值；回退用上市 LOF 主份额 161226 展示场内实时（同标的，份额类别不同）。
   */
  {
    id: "019005",
    name: "国投瑞银白银期货(LOF)C",
    kind: "otc",
    fallbackSecid: "0.161226"
  }
];
