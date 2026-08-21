'use client';

import { useEffect, useState } from 'react';

import {
  addEnterpriseCartItem,
  ENTERPRISE_CART_STORAGE_KEY,
  type EnterpriseCartItem,
  parseEnterpriseCart,
} from '../../../../enterprise-cart';

export function EnterpriseAddToCartButton({ item }: { readonly item: EnterpriseCartItem }) {
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setAdded(parseEnterpriseCart(localStorage.getItem(ENTERPRISE_CART_STORAGE_KEY))
      .some(({ skuId }) => skuId === item.skuId));
  }, [item.skuId]);

  const add = () => {
    const cart = addEnterpriseCartItem(
      parseEnterpriseCart(localStorage.getItem(ENTERPRISE_CART_STORAGE_KEY)),
      item,
    );
    localStorage.setItem(ENTERPRISE_CART_STORAGE_KEY, JSON.stringify(cart));
    setAdded(true);
  };

  return (
    <div data-cart-sku-id={item.skuId} style={{ alignItems: 'center', display: 'flex', gap: 12, marginTop: 12 }}>
      <button className="button" onClick={add} type="button">加入企业采购车</button>
      <span aria-live="polite">{added ? '已加入' : ''}</span>
    </div>
  );
}
