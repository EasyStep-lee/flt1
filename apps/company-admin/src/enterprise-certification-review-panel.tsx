import type { components } from '@fulishe/contracts';
import { Alert, Button, Card, Empty, Space, Table, Tag, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { createCompanyAdminApiClient } from './api-client.js';

type Enterprise = components['schemas']['EnterpriseRegistrationResponseDto'];
type EnterprisePage = components['schemas']['EnterpriseRegistrationPageResponseDto'];

const api = createCompanyAdminApiClient(import.meta.env.VITE_API_BASE_URL ?? '');

const colors: Record<Enterprise['status'], string> = {
  DRAFT: 'default',
  PENDING_REVIEW: 'processing',
  CORRECTION_REQUIRED: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'error',
  REJECTED: 'default',
};

const message = (error: unknown): string => {
  if (error && typeof error === 'object' && 'message' in error) {
    const value = error as { readonly message?: unknown };
    if (typeof value.message === 'string') return value.message;
  }
  return '企业认证列表暂时无法加载。';
};

export function EnterpriseCertificationReviewPanel() {
  const [data, setData] = useState<EnterprisePage>();
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await api.GET('/v1/company/enterprise-registrations');
      if (!result.data) {
        setError(message(result.error));
        setData(undefined);
        return;
      }
      setData(result.data);
    } catch {
      setError('网络离线或请求超时，请恢复网络后重新查询。');
      setData(undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (
    enterprise: Enterprise,
    decision: 'APPROVE' | 'REQUEST_CORRECTION',
  ) => {
    setReviewingId(enterprise.id);
    setError(undefined);
    try {
      const result = await api.POST(
        '/v1/company/enterprise-registrations/{enterpriseId}/review',
        {
          params: {
            header: { 'Idempotency-Key': crypto.randomUUID() },
            path: { enterpriseId: enterprise.id },
          },
          body:
            decision === 'APPROVE'
              ? { decision, version: enterprise.version, opinion: '企业主体及认证资料审核通过' }
              : {
                  decision,
                  version: enterprise.version,
                  opinion: '请核对并补正开票资料',
                  correctionFields: ['INVOICE_PROFILE'],
                },
        },
      );
      if (!result.data) {
        setError(message(result.error));
        return;
      }
      setData((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === result.data?.id ? result.data : item,
              ),
            }
          : current,
      );
    } catch {
      setError('审核结果未知，请重新查询最新版本，勿凭页面提示重复判断。');
    } finally {
      setReviewingId(undefined);
    }
  };

  return (
    <Card className="supplier-table-card" bordered={false} data-enterprise-certification-review>
      <div className="table-toolbar">
        <div>
          <Typography.Title level={3}>企业采购认证审核</Typography.Title>
          <Typography.Text type="secondary">
            仅 COMPANY_SUPPLIER_OPS 职能可审核；申请人与审核人按自然人身份隔离。
          </Typography.Text>
        </div>
        <Button onClick={() => void load()}>刷新企业认证</Button>
      </div>
      {error ? <Alert message={error} showIcon type="error" /> : null}
      <Table<Enterprise>
        dataSource={data?.items ?? []}
        loading={loading}
        locale={{ emptyText: <Empty description="暂无企业认证申请" /> }}
        pagination={false}
        rowKey="id"
        scroll={{ x: 820 }}
        columns={[
          {
            title: '企业主体',
            key: 'enterprise',
            render: (_value, row) => (
              <div className="supplier-name">
                <strong>{row.legalName}</strong>
                <span>{row.creditCodeMasked}</span>
              </div>
            ),
          },
          {
            title: '管理员',
            key: 'administrator',
            render: (_value, row) => (
              <span>{row.administratorName} · {row.administratorMobileMasked}</span>
            ),
          },
          {
            title: '证照',
            dataIndex: 'businessLicenseProvided',
            key: 'license',
            render: (provided: boolean) => (
              <Tag color={provided ? 'green' : 'orange'}>{provided ? '已提交' : '待补充'}</Tag>
            ),
          },
          {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: Enterprise['status']) => <Tag color={colors[status]}>{status}</Tag>,
          },
          {
            title: '操作',
            key: 'actions',
            render: (_value, row) =>
              row.status === 'PENDING_REVIEW' ? (
                <Space wrap>
                  <Button
                    loading={reviewingId === row.id}
                    onClick={() => void review(row, 'APPROVE')}
                    type="primary"
                  >
                    通过认证
                  </Button>
                  <Button onClick={() => void review(row, 'REQUEST_CORRECTION')}>要求补正开票资料</Button>
                </Space>
              ) : (
                <Typography.Text type="secondary">等待企业提交或已处理</Typography.Text>
              ),
          },
        ]}
      />
    </Card>
  );
}
