import React, { useRef, useState } from "react";
import {
  Input,
  Table,
  Card,
  Button,
  Modal,
  Select,
  message,
  Form,
  Input as AntdInput,
  DatePicker,
  Popconfirm,
} from "antd";
import {
  useGetAllProductsQuery,
  useUpdateProductMutation,
} from "../../context/service/addproduct.service";
import { useRecordSaleMutation } from "../../context/service/sale.service";
import {
  useSellProductFromStoreMutation,
  useGetStoreProductsQuery,
} from "../../context/service/store.service";
import {
  useCreateDebtorMutation,
  useEditDebtorMutation,
  useGetDebtorsQuery,
} from "../../context/service/debtor.service";
import { useGetUsdRateQuery } from "../../context/service/usd.service";
import "./Kassa.css";
import Qarzdor from "../qarzdorlar/Qarzdor";
import Xarajatlar from "../Xarajatlar/Xarajatlar";
import { useReactToPrint } from "react-to-print";
import moment from "moment-timezone";
import Vazvrat from "../vazvrat/Vazvrat";
import tgqr from "../../assets/tgqr.png";
import logo from "../../assets/logo.png";
import SotuvTarix from "../sotuv-tarix/Sotuv_tarix";
import {
  useCompleteNasiyaMutation,
  useCreateNasiyaMutation,
  useGetNasiyaQuery,
} from "../../context/service/nasiya.service";
const { Option } = Select;
export default function Kassa() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("naqd");
  const [debtorName, setDebtorName] = useState("");
  const [debtorPhone, setDebtorPhone] = useState("");
  const [chekModal, setChekModal] = useState(false);
  const [qarzdorModalVisible, setQarzdorModalVisible] = useState(false);
  const [xarajatlarModalVisible, setXarajatlarModalVisible] = useState(false);
  const [vazvratModalVisible, setVazvratModalVisible] = useState(false);
  const receiptRef = useRef();
  const [debtDueDate, setDebtDueDate] = useState(null);

  const {
    data: products,
    isLoading,
    refetch: productRefetch,
  } = useGetAllProductsQuery();

  const { data: storeProducts, refetch: storeRefetch } =
    useGetStoreProductsQuery();
  const { data: usdRateData } = useGetUsdRateQuery();
  const [updateProduct] = useUpdateProductMutation();
  const [recordSale] = useRecordSaleMutation();
  const [sellProductFromStore] = useSellProductFromStoreMutation();
  const [createDebtor] = useCreateDebtorMutation();
  const [location, setLocation] = useState(null);
  const [sotuvtarixiModalVisible, setSotuvtarixiModalVisible] = useState(false);
  const currency = "usd";
  const [nasiyaModal, setNasiyaModal] = useState(false);
  const [createNasiya] = useCreateNasiyaMutation();
  const [completeNasiya] = useCompleteNasiyaMutation();
  const { data: nasiya = [] } = useGetNasiyaQuery();
  const [nasiyaModalVisible, setNasiyaModalVisible] = useState(false);
  const [nasiyaPaymentMethod, setNasiyaPaymentMethod] = useState("naqd");
  const [sellPrice, setSellPrice] = useState(null);
  const { data: debtors = [] } = useGetDebtorsQuery();
  const [selectedDebtor, setSelectedDebtor] = useState(null);
  const [editDebtor] = useEditDebtorMutation();

  const handlePrint = useReactToPrint({
    content: () => receiptRef.current,
    documentTitle: "new document",
    pageStyle: "style",
    onAfterPrint: () => {
      setChekModal(false);
      setSelectedProducts([]);
    },
  });

  const filteredProducts = searchTerm
    ? products?.filter((product) => {
        const searchWords = searchTerm.toLowerCase().split(" ");
        const fields = [
          product.product_name?.toLowerCase() || "",
          product.barcode?.toLowerCase() || "",
          product.product_category?.toLowerCase() || "",
          product.model?.toLowerCase() || "",
          product.brand_name?.toLowerCase() || "",
        ];
        return searchWords.every((word) =>
          fields.some((field) => field.includes(word))
        );
      })
    : [];

  const handleSelectProduct = (product) => {
    const storeProduct = storeProducts?.find(
      (p) => p.product_id?._id === product._id
    );
    const storeQty = storeProduct?.quantity || 0;

    if (storeQty <= 0) {
      message.warning(`${product.product_name} mahsuloti dokonda tugagan`);
      return;
    }

    const exists = selectedProducts?.find((item) => item._id === product._id);
    if (!exists) {
      setSelectedProducts([
        ...selectedProducts,
        {
          ...product,
          quantity: 1,
          sell_price: product.sell_price,
        },
      ]);
      setSearchTerm("");
    } else {
      message.info("Bu mahsulot allaqachon tanlangan");
    }
  };

  const handleRemoveProduct = (productId) => {
    const updatedProducts = selectedProducts.filter(
      (item) => item._id !== productId
    );
    setSelectedProducts(updatedProducts);
  };

  const handleQuantityChange = (productId, increment) => {
    const updatedProducts = selectedProducts.map((item) => {
      if (item._id === productId) {
        const newQuantity = item.quantity + increment;
        return { ...item, quantity: newQuantity > 0 ? newQuantity : 1 };
      }
      return item;
    });
    setSelectedProducts(updatedProducts);
  };

  const handleSellPriceChange = (productId, newPrice) => {
    const updatedProducts = selectedProducts.map((item) => {
      if (item._id === productId) {
        return {
          ...item,
          sell_price: newPrice === "" ? 0 : parseFloat(newPrice) || 0,
        };
      }
      return item;
    });
    setSelectedProducts(updatedProducts);
  };

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const handleSellProducts = async () => {
    setChekModal(true);
    try {
      // Avval mahsulotlarni skaladdan yoki dokondan ayirish
      for (const product of selectedProducts) {
        if (location === "skalad") {
          if (product.stock < product.quantity) {
            message.error(
              `${product.product_name} mahsuloti skaladda yetarli emas!`
            );
            return;
          }
          const newStock = product.stock - product.quantity;
          await updateProduct({ id: product._id, stock: newStock }).unwrap();
        } else if (location === "dokon") {
          const storeProduct = storeProducts?.find(
            (p) => p.product_id?._id === product._id
          );
          if (!storeProduct) {
            message.error(
              `${product.product_name} mahsuloti dokonda mavjud emas!`
            );
            return;
          }
          if (storeProduct.quantity < product.quantity) {
            message.error(
              `${product.product_name} mahsuloti dokonda yetarli emas!`
            );
            return;
          }
          await sellProductFromStore({
            product_id: storeProduct.product_id._id,
            quantity: product.quantity,
          }).unwrap();
        }
      }

      // Keyin to'lov usuliga qarab saqlash
      if (paymentMethod === "qarz") {
        // QARZ uchun
        const debtorProducts = selectedProducts.map((product) => ({
          product_id: product._id,
          product_name: product.product_name,
          product_quantity: product.quantity,
          sell_price: product.sell_price,
          due_date: debtDueDate,
        }));

        const totalDebtInUSD = debtorProducts.reduce((acc, p) => {
          return acc + p.sell_price * p.product_quantity;
        }, 0);

        if (!selectedDebtor) {
          // Yangi qarzdor yaratish
          const debtorPayload = {
            name: debtorName?.trim(),
            phone: debtorPhone?.trim(),
            due_date: debtDueDate,
            currency: "usd",
            debt_amount: totalDebtInUSD,
            products: debtorProducts,
          };
          await createDebtor(debtorPayload).unwrap();
        } else {
          // Mavjud qarzdorga qo'shish
          const debtor = debtors.find((d) => d._id === selectedDebtor);
          if (!debtor) {
            message.error("Tanlangan qarzdor topilmadi");
            return;
          }

          const newDebtAmount = debtorProducts.reduce((acc, p) => {
            return acc + p.sell_price * p.product_quantity;
          }, 0);

          const updatedDebtAmount = (debtor.debt_amount || 0) + newDebtAmount;
          const updatedProducts = [
            ...(debtor.products || []),
            ...debtorProducts,
          ];

          await editDebtor({
            id: selectedDebtor,
            body: {
              debt_amount: updatedDebtAmount,
              due_date: debtDueDate,
              products: updatedProducts,
            },
          }).unwrap();
        }
      } else {
        // NAQD yoki PLASTIK uchun
        for (const product of selectedProducts) {
          const sale = {
            product_id: product._id,
            product_name: product.product_name,
            sell_price: product.sell_price,
            quantity: product.quantity,
            currency: "usd",
            total_price_sum:
              product.sell_price * product.quantity * usdRateData?.rate,
            total_price: product.sell_price * product.quantity,
            payment_method: paymentMethod,
            product_quantity: product.quantity,
            debtor_name: null,
            debtor_phone: null,
            due_date: null,
          };
          await recordSale(sale).unwrap();
        }
      }

      setSelectedProducts([]);
      message.success("Mahsulotlar muvaffaqiyatli sotildi!");
      setIsModalVisible(false);
    } catch (error) {
      console.error("Error:", error);
      message.error(
        `Xatolik: ${error.data?.message || "Serverga ulanishda xatolik"}`
      );
    }
  };

  const totalAmount = selectedProducts.reduce((acc, product) => {
    return acc + product.sell_price * product.quantity;
  }, 0);

  return (
    <div className="kassa-container">
      <Modal
        open={chekModal}
        style={{ display: "flex", justifyContent: "center" }}
        onCancel={() => setChekModal(false)}
        footer={[
          <Button type="primary" onClick={handlePrint}>
            Chop etish
          </Button>,
        ]}
        title="To'lov cheki"
      >
        <div
          className="receipt"
          ref={receiptRef}
          style={{
            width: "80mm",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            paddingInline: "2px",
            gap: "6px",
            display: "flex",
          }}
        >
          <h1
            style={{
              fontSize: "20px",
              display: "flex",
              width: "100%",
              alignItems: "center",
              gap: "20px",
              fontWeight: "bold",
            }}
          >
            <img src={logo} alt="" width={90} />
            EUROPE GAZ
          </h1>
          <div className="chek_item">
            <p
              style={{
                fontSize: "20px",
                textAlign: "start",
                fontWeight: "bold",
              }}
            >
              Akmalxon: <span>+99893 673 33 33</span> <br />
              Bahromjon <span>+99891 367 70 80</span> <br />
            </p>
          </div>
          <p id="tgqr_p">
            Телеграм каналимизга уланиш учун QR-кодни телефонингизда сканер
            қилинг.
            <img id="tgqr" src={tgqr} alt="" />
          </p>
          <div className="chek_item">
            <b>
              Сана:{" "}
              <b>{moment().tz("Asia/Tashkent").format("DD.MM.YYYY HH:mm")}</b>
            </b>
          </div>
          <table className="table">
            <thead>
              <tr>
                <td>№</td>
                <td>Товар</td>
                <td>Улчов</td>
                <td>Сони</td>
                <td>Сумма (USD)</td>
              </tr>
            </thead>
            <tbody>
              {selectedProducts?.map((item, index) => (
                <tr key={item._id}>
                  <td style={{ paddingBlock: "20px" }}>{index + 1}</td>
                  <td style={{ paddingBlock: "20px" }}>{item.product_name}</td>
                  <td style={{ paddingBlock: "20px" }}>{item.count_type}</td>
                  <td style={{ paddingBlock: "20px" }}>{item.quantity}</td>
                  <td style={{ paddingBlock: "20px" }}>
                    {(item.quantity * item.sell_price).toLocaleString()}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={4} style={{ border: "none" }}></td>
                <td>
                  <h1>Жами:</h1>
                  {totalAmount.toLocaleString()} USD
                </td>
              </tr>
            </tbody>
          </table>
          <h1 style={{ textAlign: "center" }}>
            Bizda yetkazib berish xizmati mavjud: Bahromjon{" "}
            <span>+99891 367 70 80</span> <br />
          </h1>
        </div>
      </Modal>

      <Modal
        title="Qarzdorlar"
        open={qarzdorModalVisible}
        onCancel={() => setQarzdorModalVisible(false)}
        footer={null}
        width="80%"
      >
        <Qarzdor />
      </Modal>

      <Modal
        title="Xarajatlar"
        open={xarajatlarModalVisible}
        onCancel={() => setXarajatlarModalVisible(false)}
        footer={null}
        width="80%"
      >
        <Xarajatlar />
      </Modal>

      <Modal
        title="Vazvrat tavarlar"
        open={vazvratModalVisible}
        onCancel={() => setVazvratModalVisible(false)}
        footer={null}
        width="80%"
      >
        <Vazvrat />
      </Modal>

      <Modal
        title="Sotuv Tarixi"
        open={sotuvtarixiModalVisible}
        onCancel={() => setSotuvtarixiModalVisible(false)}
        footer={null}
        width="80%"
      >
        <SotuvTarix />
      </Modal>

      <Modal
        title="Tovarni nasiyaga berish"
        open={nasiyaModal}
        footer={[]}
        onCancel={() => setNasiyaModal(false)}
      >
        <form
          className="modal_form"
          onSubmit={async (e) => {
            e.preventDefault();
            const name = e.target.name.value;
            const location = e.target.location.value;

            if (!name) {
              message.error("Ismni to'ldiring!");
              return;
            }
            if (!location) {
              message.error("Joylashuvni to'ldiring!");
              return;
            }
            try {
              for (const product of selectedProducts) {
                if (location === "skalad") {
                  if (product.stock < product.quantity) {
                    message.error(
                      `${product.product_name} mahsuloti skaladda yetarli emas!`
                    );
                    return;
                  }
                  await createNasiya({
                    product_id: product._id,
                    product_name: product.product_name,
                    quantity: product.quantity,
                    location: location,
                    nasiya_name: name,
                  });
                } else {
                  const storeProduct = storeProducts?.find(
                    (p) => p.product_id?._id === product._id
                  );
                  if (!storeProduct) {
                    message.error(
                      `${product.product_name} mahsuloti dokonda mavjud emas!`
                    );
                    return;
                  }
                  if (storeProduct.quantity < product.quantity) {
                    message.error(
                      `${product.product_name} mahsuloti dokonda yetarli emas!`
                    );
                    return;
                  }
                  await createNasiya({
                    product_id: product._id,
                    quantity: product.quantity,
                    location: location,
                    nasiya_name: name,
                  });
                }
              }
              message.success("Mahsulotlar muvaffaqiyatli nasiyaga berildi!");
              setNasiyaModal(false);
              setSelectedProducts([]);
              storeRefetch();
              productRefetch();
            } catch (error) {
              console.error("Xatolik:", error);
              message.error("Xatolik yuz berdi, iltimos qayta urinib ko'ring!");
            }
          }}
        >
          <p>Nasiyaga oluvchi ismi</p>
          <input placeholder="Ism" required type="text" name="name" />
          <select required name="location">
            <option value="skalad">Skalad</option>
            <option value="dokon">Do'kon</option>
          </select>
          <Button type="primary" htmlType="submit">
            Nasiyaga berish
          </Button>
        </form>
      </Modal>

      <Modal
        width={"900px"}
        title="Nasiyalar"
        open={nasiyaModalVisible}
        footer={null}
        onCancel={() => {
          setNasiyaModalVisible(false);
          setSellPrice("");
          setNasiyaPaymentMethod("naqd");
        }}
      >
        <table className="table">
          <thead>
            <tr>
              <th>Tovar</th>
              <th>Soni</th>
              <th>Sotish narx</th>
              <th>Model</th>
              <th>Nasiyaga oluvchi</th>
              <th>Sana</th>
              <th>Nasiyani yopish</th>
            </tr>
          </thead>
          <tbody>
            {nasiya
              .filter((n) => n.status === "active")
              .map((item) => (
                <tr key={item._id}>
                  <td>{item.product_name}</td>
                  <td>{item.quantity}</td>
                  <td>
                    {products
                      ?.find((p) => p._id === item.product_id)
                      ?.sell_price.toLocaleString()}
                  </td>
                  <td>
                    {products?.find((p) => p._id === item.product_id)?.model}
                  </td>
                  <td>{item.nasiya_name}</td>
                  <td>{moment(item.createdAt).format("DD.MM.YYYY HH:mm")}</td>
                  <td>
                    <Popconfirm
                      title={
                        <div className="modal_form">
                          <p>Sotish narxi:</p>
                          <input
                            type="number"
                            value={sellPrice}
                            onChange={(e) => setSellPrice(e.target.value)}
                          />
                          <p>To'lov usuli:</p>
                          <select
                            style={{ width: "100%" }}
                            value={nasiyaPaymentMethod}
                            onChange={(e) =>
                              setNasiyaPaymentMethod(e.target.value)
                            }
                          >
                            <option value="naqd">Naqd</option>
                            <option value="plastik">Karta</option>
                          </select>
                        </div>
                      }
                      onConfirm={async () => {
                        if (!sellPrice) {
                          message.error("Sotish narxini kiriting!");
                          return;
                        }
                        try {
                          await completeNasiya({
                            id: item._id,
                            sell_price: Number(sellPrice),
                            payment_method: nasiyaPaymentMethod,
                          });
                          message.success("Nasiya yopildi");
                          setSellPrice(null);
                          setNasiyaPaymentMethod("naqd");
                        } catch (error) {
                          message.error("Xatolik yuz berdi!");
                        }
                      }}
                      okText="Yopish"
                      cancelText="Bekor qilish"
                    >
                      <Button type="primary" style={{ margin: "4px 0" }}>
                        Yopish
                      </Button>
                    </Popconfirm>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </Modal>

      <div className="kassa-header">
        <Button
          type="primary"
          onClick={() => setQarzdorModalVisible(true)}
          style={{ marginRight: 10 }}
        >
          Qarzdorlar
        </Button>
        <Button
          type="primary"
          onClick={() => setXarajatlarModalVisible(true)}
          style={{ marginRight: 10 }}
        >
          Xarajatlar
        </Button>
        <Button
          type="primary"
          onClick={() => setVazvratModalVisible(true)}
          style={{ marginRight: 10 }}
        >
          Vazvrat tavarlar
        </Button>
        <Button
          type="primary"
          onClick={() => setSotuvtarixiModalVisible(true)}
          style={{ marginRight: 10 }}
        >
          Sotuv Tarixi
        </Button>
      </div>

      <Card
        title="Kassa"
        bordered={false}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          flexDirection: "column-reverse",
          alignItems: "stretch",
          backgroundColor: "#0F4C81",
          width: "80%",
          height: "100%",
          color: "white",
          borderRadius: 0.1,
          overflow: "auto",
        }}
        id="kassa"
      >
        <Input
          placeholder="shtrix kodi yoki katalog kiriting..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ marginBottom: 20, width: "40%" }}
          size="large"
        />
        <Table
          dataSource={filteredProducts}
          loading={isLoading}
          style={{ width: "100%" }}
          columns={[
            {
              title: "Mahsulot nomi",
              dataIndex: "product_name",
              key: "product_name",
            },
            {
              title: "Tan narxi",
              dataIndex: "purchase_price",
              key: "purchase_price",
            },
            {
              title: "Narxi (USD)",
              dataIndex: "sell_price",
              key: "sell_price",
              render: (text) => `${text.toLocaleString()} USD`,
            },
            {
              title: "Dokon Miqdori",
              dataIndex: "quantity",
              key: "quantity",
              render: (_, record) =>
                storeProducts?.find(
                  (product) => product.product_id?._id === record._id
                )?.quantity || 0,
            },
            { title: "Shtrix kod", dataIndex: "barcode", key: "barcode" },
            { title: "Modeli", dataIndex: "model", key: "model" },
            { title: "Qutisi", dataIndex: "packing_type", key: "packing_type" },
            { title: "Izoh", dataIndex: "special_notes", key: "special_notes" },
            { title: "Brend", dataIndex: "brand_name", key: "brand_name" },
            {
              title: "kimdan-kelgan",
              dataIndex: "kimdan_kelgan",
              key: "kimdan_kelgan",
            },
            {
              title: "Harakatlar",
              key: "actions",
              render: (_, record) => (
                <Button
                  type="primary"
                  disabled={
                    storeProducts?.find(
                      (product) => product.product_id?._id === record._id
                    )?.quantity <= 0
                  }
                  onClick={() => handleSelectProduct(record)}
                >
                  Tanlash
                </Button>
              ),
            },
          ]}
          rowKey="_id"
          pagination={{ pageSize: 10 }}
        />
        {selectedProducts.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h2>Tanlangan mahsulotlar:</h2>
            <Table
              dataSource={selectedProducts}
              style={{ width: "100%" }}
              columns={[
                {
                  title: "Mahsulot nomi",
                  dataIndex: "product_name",
                  key: "product_name",
                },
                {
                  title: "Tan narxi",
                  dataIndex: "purchase_price",
                  key: "purchase_price",
                },
                {
                  title: "Narxi (USD)",
                  key: "sell_price",
                  render: (_, record) => (
                    <input
                      type="number"
                      value={record.sell_price}
                      onChange={(e) => {
                        handleSellPriceChange(record._id, e.target.value);
                      }}
                      style={{ width: "100px" }}
                    />
                  ),
                },
                { title: "Miqdori", dataIndex: "quantity", key: "quantity" },
                { title: "Shtrix kod", dataIndex: "barcode", key: "barcode" },
                {
                  title: "Soni",
                  key: "quantity",
                  render: (_, record) => (
                    <div>
                      <Button
                        onClick={() => handleQuantityChange(record._id, -1)}
                        disabled={record.quantity <= 1}
                      >
                        -
                      </Button>
                      <span style={{ margin: "0 10px" }}>
                        {record.quantity}
                      </span>
                      <Button
                        onClick={() => handleQuantityChange(record._id, 1)}
                        disabled={
                          record.quantity ===
                          storeProducts?.find(
                            (product) => product.product_id?._id === record._id
                          )?.quantity
                        }
                      >
                        +
                      </Button>
                    </div>
                  ),
                },
                {
                  title: "Harakatlar",
                  key: "actions",
                  render: (_, record) => (
                    <Button
                      type="primary"
                      danger
                      onClick={() => handleRemoveProduct(record._id)}
                    >
                      O'chirish
                    </Button>
                  ),
                },
              ]}
              rowKey="_id"
              pagination={false}
            />
            <div style={{ marginTop: 20, fontSize: "1.5em" }}>
              <strong>Umumiy summa: </strong>
              {totalAmount.toLocaleString()} USD
            </div>
            <Button
              type="primary"
              onClick={showModal}
              style={{ marginTop: 20 }}
            >
              Sotish
            </Button>
          </div>
        )}
        <Modal
          title="To'lov usulini tanlang"
          visible={isModalVisible}
          onOk={handleSellProducts}
          onCancel={handleCancel}
        >
          <Form layout="vertical">
            <Form.Item label="To'lov usuli">
              <Select
                value={paymentMethod}
                onChange={(value) => setPaymentMethod(value)}
                style={{ width: "100%" }}
              >
                <Option value="naqd">Naqd</Option>
                <Option value="plastik">Karta</Option>
                <Option value="qarz">Qarz</Option>
              </Select>
            </Form.Item>
            {paymentMethod === "qarz" && (
              <>
                <Form.Item label="Qarz oluvchi">
                  <Select
                    showSearch
                    placeholder="Qarzdorni tanlang"
                    optionFilterProp="children"
                    value={selectedDebtor}
                    onChange={(value) => {
                      if (value === "new") {
                        setDebtorName("");
                        setDebtorPhone("");
                        setSelectedDebtor(null);
                      } else {
                        setSelectedDebtor(value);
                      }
                    }}
                    filterOption={(input, option) => {
                      const debtor = debtors.find(
                        (d) => d._id === option?.value
                      );
                      if (!debtor) return false;
                      return (
                        debtor.name
                          .toLowerCase()
                          .includes(input.toLowerCase()) ||
                        debtor.phone.toLowerCase().includes(input.toLowerCase())
                      );
                    }}
                    style={{ width: "100%" }}
                  >
                    <Option value="new">➕ Yangi xaridor</Option>
                    {debtors.map((item) => (
                      <Option key={item._id} value={item._id}>
                        {item.name} - {item.phone}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                {!selectedDebtor && (
                  <>
                    <Form.Item label="Yangi xaridor ismi">
                      <AntdInput
                        value={debtorName}
                        onChange={(e) => setDebtorName(e.target.value)}
                      />
                    </Form.Item>
                    <Form.Item label="Telefon raqami">
                      <AntdInput
                        value={debtorPhone}
                        onChange={(e) => setDebtorPhone(e.target.value)}
                      />
                    </Form.Item>
                  </>
                )}

                <Form.Item label="Qarz muddatini kiriting">
                  <input
                    type="date"
                    value={debtDueDate}
                    onChange={(e) => setDebtDueDate(e.target.value)}
                  />
                </Form.Item>
              </>
            )}

            <Form.Item label="Joylashuv">
              <Select
                value={location}
                onChange={(value) => setLocation(value)}
                style={{ width: "100%" }}
              >
                <Option value="skalad">Skalad</Option>
                <Option value="dokon">Dokon</Option>
              </Select>
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </div>
  );
}
