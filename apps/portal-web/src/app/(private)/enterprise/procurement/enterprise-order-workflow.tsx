'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import {
  ENTERPRISE_CART_STORAGE_KEY,
  ENTERPRISE_ORDER_KEY_STORAGE_KEY,
  enterpriseCartTotal,
  type EnterpriseCartItem,
  parseEnterpriseCart,
} from '../../../../enterprise-cart';
import { createEnterpriseOrder, type EnterpriseOrderActionResult } from './checkout/actions';
import styles from './order-workflow.module.css';

const money = (cents: number): string => `¥${(cents / 100).toFixed(2)}`;

const groupCart = (items: readonly EnterpriseCartItem[]) => {
  const groups = new Map<string, EnterpriseCartItem[]>();
  for (const item of items) groups.set(item.supplierId, [...(groups.get(item.supplierId) ?? []), item]);
  return [...groups.entries()];
};

export function EnterpriseOrderWorkflow({ mode }: { readonly mode: 'cart' | 'checkout' }) {
  const [items, setItems] = useState<readonly EnterpriseCartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EnterpriseOrderActionResult>();
  useEffect(() => {
    setItems(parseEnterpriseCart(localStorage.getItem(ENTERPRISE_CART_STORAGE_KEY)));
    setReady(true);
  }, []);
  const groups = useMemo(() => groupCart(items), [items]);
  const total = enterpriseCartTotal(items);

  const submit = async () => {
    if (items.length === 0 || submitting) return;
    let idempotencyKey = sessionStorage.getItem(ENTERPRISE_ORDER_KEY_STORAGE_KEY);
    if (!idempotencyKey) {
      idempotencyKey = `ent-${crypto.randomUUID()}`;
      sessionStorage.setItem(ENTERPRISE_ORDER_KEY_STORAGE_KEY, idempotencyKey);
    }
    setSubmitting(true);
    try {
      const response = await createEnterpriseOrder(
        items.map(({ skuId, quantity }) => ({ skuId, quantity })),
        idempotencyKey,
      );
      setResult(response);
      if (response.ok) {
        localStorage.removeItem(ENTERPRISE_CART_STORAGE_KEY);
        sessionStorage.removeItem(ENTERPRISE_ORDER_KEY_STORAGE_KEY);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (result?.ok) {
    return (
      <main className={styles.page} data-shell="enterprise-order-result">
        <h1>订单提交成功</h1>
        <p>主订单号：{result.order.orderNo}</p>
        <p>由{result.order.sellerName}统一结账，各供应商分别履约。</p>
        <div className={styles.groups}>
          {result.order.supplierFulfillments.map((fulfillment) => (
            <section className={styles.group} data-fulfillment-group key={fulfillment.fulfillmentOrderId}>
              <h2>供应商履约组</h2>
              <p>{fulfillment.itemCount} 件商品 · {money(fulfillment.goodsAmount)}</p>
              <p>待完成企业付款</p>
            </section>
          ))}
        </div>
        <strong>主订单合计 {money(result.order.totalAmount)}</strong>
      </main>
    );
  }

  const title = mode === 'cart' ? '企业采购车' : '企业采购结算';
  return (
    <main className={styles.page} data-shell={`enterprise-${mode}`}>
      <p style={{ color: '#8a5a00', margin: 0 }}>社区集采 · 普通企业采购入口</p>
      <h1>{title}</h1>
      {!ready ? <p aria-live="polite">正在读取采购车…</p> : null}
      {ready && items.length === 0 ? (
        <section className={styles.summary}>
          <p>采购车为空。</p>
          <Link href="/enterprise/procurement/products">返回企业采购货架</Link>
        </section>
      ) : null}
      {items.length > 0 ? (
        <>
          {mode === 'checkout' ? (
            <p className={styles.summary}>
              向江苏福礼团供应链科技有限公司提交 1 张主订单；收货与开票使用企业已审核默认资料。
            </p>
          ) : null}
          <div className={styles.groups}>
            {groups.map(([supplierId, group], index) => (
              <section
                className={styles.group}
                data-checkout-supplier-group={mode === 'checkout' ? '' : undefined}
                data-supplier-group={mode === 'cart' ? '' : undefined}
                key={supplierId}
              >
                <h2>供应来源 {index + 1}</h2>
                <ul>
                  {group.map((item) => (
                    <li className={styles.line} key={item.skuId}>
                      <span>{item.productName} × {item.quantity}</span>
                      <strong>{money(item.enterpriseSalePrice * item.quantity)}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <div className={styles.action}>
            <strong>合计 {money(total)}</strong>
            {mode === 'cart' ? (
              <Link className={styles.primary} href="/enterprise/procurement/checkout">去统一结算</Link>
            ) : (
              <button className={styles.primary} disabled={submitting} onClick={submit} type="button">
                {submitting ? '正在提交…' : '提交企业订单'}
              </button>
            )}
          </div>
        </>
      ) : null}
      {result && !result.ok ? <p className={styles.error} role="alert">{result.message}</p> : null}
    </main>
  );
}
