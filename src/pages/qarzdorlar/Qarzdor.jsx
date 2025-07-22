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

  const formatNumber = (num, curr) => {
    const formatted = Number(num || 0).toLocaleString("uz-UZ");
    return curr === "usd" ? `${formatted} $` : `${formatted} so'm`;
  };

  const correctedPrice = (price, currency) => {
    if (currency === "usd" && price > 0 && price < 100) {
      return price * usdRateData.rate;
    }
    return price;
  };

  const correctedTotal = (price, quantity, currency) => {
    return correctedPrice(price, currency) * quantity;
  };

  // Qarzdorning jami qarzini to'g'ri hisoblash
  const calculateTotalDebt = (debtor) => {
    const currency = debtor.currency || "usd";
    const rate = usdRateData?.rate || 1;

    if (currency === "usd") {
      return debtor.debt_amount * rate; // USD ni So'mga o'tkazish
    }
    return debtor.debt_amount; // So'm bo'lsa o'zgarishsiz
  };

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
        currency: "usd", // yoki siz frontendda tanlasa, uni oling
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
      title: "Jami qarz",
      render: (_, record) => {
        const totalDebt = calculateTotalDebt(record);
        const currency = record.currency || "usd";

        // Har doim So'mda ko'rsatish
        return `${totalDebt.toLocaleString("uz-UZ")} so'm`;
      },
    },
    {
      title: "Valyuta",
      render: (_, record) => {
        const currency = record.currency || "usd";
        return currency === "usd" ? "USD" : "So'm";
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
                    title: "Summa",
                    dataIndex: "amount",
                    key: "amount",
                    render: (amount, paymentRecord) => {
                      const currency =
                        paymentRecord.currency || record.currency || "usd";
                      return formatNumber(amount, currency);
                    },
                  },
                  {
                    title: "Valyuta",
                    dataIndex: "currency",
                    render: (currency) => (currency === "usd" ? "USD" : "So'm"),
                  },
                  {
                    title: "Sana",
                    dataIndex: "date",
                    render: (text) => moment(text).format("YYYY-MM-DD"),
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
              values.id = paymentDebtor._id; // paymentDebtor o'rniga paymentDebtor._id
              values.amount = Number(values.amount);
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
            label="To'lov summasi"
            name="amount"
            rules={[{ required: true, message: "Summani kiriting" }]}
          >
            <Input type="number" min={1} />
          </Form.Item>

          <Form.Item
            label="Valyuta"
            name="currency"
            rules={[{ required: true, message: "Valyutani tanlang" }]}
            initialValue="usd"
          >
            <Select>
              <Select.Option value="usd">USD</Select.Option>
              <Select.Option value="sum">So'm</Select.Option>
            </Select>
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

          const debtorCurrency = selectedDebtor.currency || "usd";
          const usdRate = usdRateData?.rate || 1;

          const originalPrice = Number(product.sell_price || 0);
          const quantity = Number(product.product_quantity || 1);

          // Valyuta bo'yicha to'g'ri narx hisoblash
          const displayPrice =
            debtorCurrency === "sum" ? originalPrice : originalPrice * usdRate;

          const total = displayPrice * quantity;

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
                <b>Narxi:</b>{" "}
                {debtorCurrency === "sum"
                  ? `${displayPrice.toLocaleString("uz-UZ")} so'm`
                  : `${displayPrice.toLocaleString(
                      "uz-UZ"
                    )} so'm (${originalPrice.toLocaleString("uz-UZ")} $)`}
              </p>
              <p>
                <b>Qarz:</b>{" "}
                {debtorCurrency === "sum"
                  ? `${total.toLocaleString("uz-UZ")} so'm`
                  : `${total.toLocaleString("uz-UZ")} so'm (${(
                      total / usdRate
                    ).toLocaleString("uz-UZ")} $)`}
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
