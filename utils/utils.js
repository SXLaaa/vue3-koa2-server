/*
 * @Description:
 * @Version: 2.0
 * @Autor: shiXl
 * @Date: 2021-08-15 17:25:32
 * @LastEditors: shixl shixl@dist.com.cn
 * @LastEditTime: 2024-04-19 00:17:39
 */
/**
 * 通用工具函数
 */
const log4js = require("./log4j");
const jwt = require("jsonwebtoken");
const CODE = {
  SUCCESS: 200,
  PARAM_ERROR: 10001, // 参数错误
  USER_ACCOUNT_ERROR: 20001, //账号或密码错误
  USER_LOGIN_ERROR: 30001, // 用户未登录
  BUSINESS_ERROR: 40001, //业务请求失败
  AUTH_ERROR: 500001, // 认证失败或TOKEN过期
};
module.exports = {
  /**
   * 分页结构封装
   * @param {number} pageNum
   * @param {number} pageSize
   */
  pager({ pageNum = 1, pageSize = 10 }) {
    pageNum *= 1;
    pageSize *= 1;
    const skipIndex = (pageNum - 1) * pageSize;
    return {
      page: {
        pageNum,
        pageSize,
      },
      skipIndex,
    };
  },
  success(data = "", msg = "", code = CODE.SUCCESS) {
    //  log4js.debug(data);
    return {
      code,
      data,
      msg,
    };
  },
  fail(msg = "", code = CODE.BUSINESS_ERROR, data = "") {
    log4js.debug(msg);
    return {
      code,
      data,
      msg,
    };
  },
  CODE,
  decoded(authorization) {
    if (authorization) {
      let token = authorization.split(" ")[1];
      return jwt.verify(token, "imooc");
    }
    return "";
  },
  // 递归拼接树形列表
  getTreeMenu(rootList) {
    const idToNodeMap = new Map();
    const topMenuNodes = [];

    // 初始化映射表并寻找顶级菜单
    rootList.forEach(item => {
      const unwrappedItem = item._doc || item; // 解包数据
      idToNodeMap.set(unwrappedItem._id, { ...unwrappedItem, children: [], action: [] });

      // 判断是否为顶级菜单
      const isTopLevel = !unwrappedItem.parentId || (Array.isArray(unwrappedItem.parentId) && unwrappedItem.parentId.length === 0);
      if (isTopLevel && unwrappedItem.menuType === 1) {
        topMenuNodes.push(idToNodeMap.get(unwrappedItem._id));
      }
    });

    // 构建树形结构
    function buildChildren(list, parentNode) {
      list.forEach(item => {
        if (Array.isArray(item.parentId) && item.parentId.includes(parentNode._id)) {
          const node = idToNodeMap.get(item._id);

          if (node.menuType === 1) {
            parentNode.children.push(node);
            buildChildren(list, node);
          } else if (node.menuType === 2) {
            parentNode.action.push(node);
          }
        }
      });
    }

    topMenuNodes.forEach(topNode => buildChildren(rootList, topNode));

    return topMenuNodes;
  }
  ,
  formateDate(date, rule) {
    let fmt = rule || "yyyy-MM-dd hh:mm:ss";
    if (/(y+)/.test(fmt)) {
      fmt = fmt.replace(RegExp.$1, date.getFullYear());
    }
    const o = {
      // 'y+': date.getFullYear(),
      "M+": date.getMonth() + 1,
      "d+": date.getDate(),
      "h+": date.getHours(),
      "m+": date.getMinutes(),
      "s+": date.getSeconds(),
    };
    for (let k in o) {
      if (new RegExp(`(${k})`).test(fmt)) {
        const val = o[k] + "";
        fmt = fmt.replace(
          RegExp.$1,
          RegExp.$1.length == 1 ? val : ("00" + val).substr(val.length)
        );
      }
    }
    return fmt;
  },
};
