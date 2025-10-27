import React, { useState } from "react";
import {
  Table,
  Button,
  Input,
  message,
  Modal,
  Form,
  Space,
  Select,
  Popover,
} from "antd";
import {
  useGetDebtorsQuery,
  useUpdateDebtorMutation,
  useReturnProductDebtorMutation,
  useCreateDebtorMutation,
  useCreatePaymentMutation,
} from "../../context/service/debtor.service";
import moment from "moment";
import { useGetUsdRateQuery } from "../../context/service/usd.service";
import { FaDollarSign } from "react-icons/fa";

export default function Qarzdor() {
  const { data: debtors = [], refetch } = useGetDebtorsQuery();
  const [updateDebtor] = useUpdateDebtorMutation();
  const [returnProduct] = useReturnProductDebtorMutation();
  const [paymentAmounts, setPaymentAmounts] = useState({});
  const [returnQuantities, setReturnQuantities] = useState({});
  const [selectedDebtor, setSelectedDebtor] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createPayment] = useCreatePaymentMutation();
  const [paymentDebtor, setPaymentDebtor] = useState();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [form] = Form.useForm();
  const { data: usdRateData } = useGetUsdRateQuery();

  const handlePay = async (debtorId, productId) => {
    const key = `${debtorId}_${productId}`;
    const amount = Number(paymentAmounts[key]);

    if (!amount || amount <= 0) {
      message.error("To'g'ri summa kiriting");
      return;
    }

    try {
      await createPayment({
        id: debtorId,
        product_id: productId,
        amount,
        currency: "usd",
        rate: usdRateData?.rate || 1,
      }).unwrap();

      message.success("To'lov saqlandi");
      setPaymentAmounts((prev) => ({ ...prev, [key]: "" }));
      refetch();
    } catch (err) {
      message.error("Xatolik: " + err?.data?.message);
    }
  };

  const handleReturn = async (debtorId, productId, index) => {
    const key = `${debtorId}_${productId}_${index}`;
    const quantity = Number(returnQuantities[key]);

    if (!quantity || quantity <= 0) {
      message.error("Qaytariladigan miqdor noto'g'ri");
      return;
    }

    try {
      await returnProduct({
        id: debtorId,
        product_id: productId,
        quantity,
      }).unwrap();
      message.success("Qaytarildi");
      setReturnQuantities((prev) => ({ ...prev, [key]: "" }));
      setModalOpen(false);
      setSelectedDebtor(null);
      refetch();
    } catch (err) {
      message.error("Xatolik: " + err?.data?.message);
    }
  };

  const columns = [
    { title: "Ism", dataIndex: "name", key: "name" },
    { title: "Telefon", dataIndex: "phone", key: "phone" },
    {
      title: "Mahsulotlar",
      render: (_, record) => `${record.products?.length || 0} ta mahsulot`,
    },
    {
      title: "Jami qarz (USD)",
      render: (_, record) => {
        const debtAmount = Number(record.debt_amount || 0);
        return `${debtAmount.toLocaleString("uz-UZ")} $`;
      },
    },
    {
      title: "Amallar",
      render: (_, record) => (
        <Space>
          <Button
            onClick={() => {
              setSelectedDebtor(record);
              setModalOpen(true);
            }}
          >
            Batafsil
          </Button>

          <Button
            type="primary"
            onClick={() => {
              setPaymentDebtor(record);
              setPaymentModalOpen(true);
            }}
            icon={<FaDollarSign />}
          />

          <Popover
            trigger="click"
            content={
              <Table
                dataSource={record.payment_log}
                columns={[
                  {
                    title: "Summa (USD)",
                    dataIndex: "amount",
                    key: "amount",
                    render: (amount) =>
                      `${Number(amount).toLocaleString("uz-UZ")} $`,
                  },
                  {
                    title: "Sana",
                    dataIndex: "date",
                    render: (text) => moment(text).format("YYYY-MM-DD HH:mm"),
                  },
                ]}
                pagination={false}
                size="small"
              />
            }
          >
            <Button type="dashed">To'lovlar</Button>
          </Popover>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Table
        rowKey="_id"
        columns={columns}
        dataSource={debtors}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        open={paymentModalOpen}
        title={`To'lov - ${paymentDebtor?.name}`}
        onCancel={() => {
          setPaymentModalOpen(false);
          setPaymentDebtor(null);
          form.resetFields();
        }}
        okText="To'lash"
        footer={null}
      >
        <Form
          onFinish={async (values) => {
            try {
              values.rate = usdRateData?.rate || 1;
              values.id = paymentDebtor._id;
              values.amount = Number(values.amount);
              values.currency = "usd"; // Faqat USD
              await createPayment(values).unwrap();
              message.success("To'lov amalga oshirildi");
              setPaymentModalOpen(false);
              setPaymentDebtor(null);
              form.resetFields();
              refetch();
            } catch (err) {
              message.error("Xatolik: " + err?.data?.message);
            }
          }}
          form={form}
          layout="vertical"
        >
          <Form.Item
            label="To'lov summasi (USD)"
            name="amount"
            rules={[{ required: true, message: "Summani kiriting" }]}
          >
            <Input type="number" min={0.01} step="0.01" placeholder="0.00" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit">
              To'lash
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={modalOpen}
        title={`${selectedDebtor?.name} - mahsulotlar ro'yxati`}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={900}
      >
        {selectedDebtor?.products?.map((product, index) => {
          const productId = product.product_id?._id || product.product_id;
          const key = `${selectedDebtor._id}_${productId}_${index}`;

          const originalPrice = Number(product.sell_price || 0);
          const quantity = Number(product.product_quantity || 1);
          const total = originalPrice * quantity;

          return (
            <div
              key={index}
              style={{
                marginBottom: "20px",
                borderBottom: "1px solid #ccc",
                paddingBottom: 10,
              }}
            >
              <h4>{product.product_name}</h4>
              <p>
                <b>Soni:</b> {quantity}
              </p>
              <p>
                <b>Narxi:</b> {originalPrice.toLocaleString("uz-UZ")} $
              </p>
              <p>
                <b>Qarz:</b> {total.toLocaleString("uz-UZ")} $
              </p>
              <p>
                <b>Sotish vaqti:</b>{" "}
                {moment(product.sold_date || selectedDebtor.sold_date).format(
                  "YYYY-MM-DD"
                )}
              </p>
              <p>
                <b>Qarz vaqti:</b>{" "}
                {moment(product.due_date || selectedDebtor.due_date).format(
                  "YYYY-MM-DD"
                )}
              </p>
              <Input
                placeholder="Qaytariladigan soni"
                value={returnQuantities[key] || ""}
                onChange={(e) =>
                  setReturnQuantities((prev) => ({
                    ...prev,
                    [key]: e.target.value,
                  }))
                }
                style={{ width: 150, marginRight: 8 }}
              />
              <Button
                danger
                onClick={() =>
                  handleReturn(selectedDebtor._id, productId, index)
                }
              >
                Qaytarish
              </Button>
            </div>
          );
        })}
      </Modal>
    </>
  );
}
