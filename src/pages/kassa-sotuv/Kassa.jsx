import React, { useRef, useState, useMemo, useCallback } from "react";
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
  const [location, setLocation] = useState(null);
  const [sotuvtarixiModalVisible, setSotuvtarixiModalVisible] = useState(false);
  const [nasiyaModal, setNasiyaModal] = useState(false);
  const [nasiyaModalVisible, setNasiyaModalVisible] = useState(false);
  const [nasiyaPaymentMethod, setNasiyaPaymentMethod] = useState("naqd");
  const [sellPrice, setSellPrice] = useState(null);
  const [selectedDebtor, setSelectedDebtor] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

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
  const [editDebtor] = useEditDebtorMutation();
  const { data: debtors = [] } = useGetDebtorsQuery();
  const [createNasiya] = useCreateNasiyaMutation();
  const [completeNasiya] = useCompleteNasiyaMutation();
  const { data: nasiya = [] } = useGetNasiyaQuery();

  const handlePrint = useReactToPrint({
    content: () => receiptRef.current,
    documentTitle: "new document",
    pageStyle: "style",
    onAfterPrint: () => {
      setChekModal(false);
      setSelectedProducts([]);
    },
  });

  // Optimallashtirilgan qidiruv funksiyasi - useMemo bilan
  const filteredProducts = useMemo(() => {
    if (!searchTerm || !products) return [];

    const searchWords = searchTerm.toLowerCase().split(" ");

    return products.filter((product) => {
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
    });
  }, [searchTerm, products]);

  // useCallback bilan optimallashtirilgan mahsulot tanlash
  const handleSelectProduct = useCallback(
    (product) => {
      const storeProduct = storeProducts?.find(
        (p) => p.product_id?._id === product._id
      );
      const storeQty = storeProduct?.quantity || 0;

      if (storeQty <= 0) {
        message.warning(`${product.product_name} mahsuloti dokonda tugagan`);
        return;
      }

      setSelectedProducts((prev) => {
        const exists = prev.find((item) => item._id === product._id);
        if (exists) {
          message.info("Bu mahsulot allaqachon tanlangan");
          return prev;
        }
        return [
          ...prev,
          {
            ...product,
            quantity: 1,
            sell_price: product.sell_price,
          },
        ];
      });

      setSearchTerm("");
    },
    [storeProducts]
  );

  const handleRemoveProduct = useCallback((productId) => {
    setSelectedProducts((prev) =>
      prev.filter((item) => item._id !== productId)
    );
  }, []);

  const handleQuantityChange = useCallback((productId, increment) => {
    setSelectedProducts((prev) =>
      prev.map((item) => {
        if (item._id === productId) {
          const newQuantity = item.quantity + increment;
          return { ...item, quantity: newQuantity > 0 ? newQuantity : 1 };
        }
        return item;
      })
    );
  }, []);

  const handleSellPriceChange = useCallback((productId, newPrice) => {
    setSelectedProducts((prev) =>
      prev.map((item) => {
        if (item._id === productId) {
          return {
            ...item,
            sell_price: newPrice === "" ? 0 : parseFloat(newPrice) || 0,
          };
        }
        return item;
      })
    );
  }, []);

  const showModal = useCallback(() => {
    setIsModalVisible(true);
  }, []);

  const handleCancel = useCallback(() => {
    setIsModalVisible(false);
  }, []);

  // Validatsiya funksiyasi - alohida ajratilgan
  const validateProductStock = useCallback(async () => {
    for (const product of selectedProducts) {
      if (location === "skalad") {
        if (product.stock < product.quantity) {
          throw new Error(
            `${product.product_name} mahsuloti skaladda yetarli emas!`
          );
        }
      } else if (location === "dokon") {
        const storeProduct = storeProducts?.find(
          (p) => p.product_id?._id === product._id
        );
        if (!storeProduct) {
          throw new Error(
            `${product.product_name} mahsuloti dokonda mavjud emas!`
          );
        }
        if (storeProduct.quantity < product.quantity) {
          throw new Error(
            `${product.product_name} mahsuloti dokonda yetarli emas!`
          );
        }
      }
    }
  }, [selectedProducts, location, storeProducts]);

  // Qarz yaratish funksiyasi - alohida ajratilgan
  const processDebtSale = useCallback(async () => {
    const debtorProducts = selectedProducts.map((product) => ({
      product_id: product._id,
      product_name: product.product_name,
      product_quantity: product.quantity,
      sell_price: product.sell_price,
      due_date: debtDueDate,
    }));

    const totalDebtInUSD = debtorProducts.reduce(
      (acc, p) => acc + p.sell_price * p.product_quantity,
      0
    );

    if (!selectedDebtor) {
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
      const debtor = debtors.find((d) => d._id === selectedDebtor);
      if (!debtor) {
        throw new Error("Tanlangan qarzdor topilmadi");
      }

      const updatedDebtAmount = (debtor.debt_amount || 0) + totalDebtInUSD;
      const updatedProducts = [...(debtor.products || []), ...debtorProducts];

      await editDebtor({
        id: selectedDebtor,
        body: {
          debt_amount: updatedDebtAmount,
          due_date: debtDueDate,
          products: updatedProducts,
        },
      }).unwrap();
    }
  }, [
    selectedProducts,
    debtDueDate,
    selectedDebtor,
    debtorName,
    debtorPhone,
    debtors,
    createDebtor,
    editDebtor,
  ]);

  // Oddiy sotuv funksiyasi - alohida ajratilgan
  const processRegularSale = useCallback(async () => {
    const salePromises = selectedProducts.map((product) => {
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
      return recordSale(sale).unwrap();
    });

    await Promise.all(salePromises);
  }, [selectedProducts, paymentMethod, usdRateData, recordSale]);

  // Omborni yangilash funksiyasi - alohida ajratilgan
  const updateInventory = useCallback(async () => {
    const updatePromises = selectedProducts.map(async (product) => {
      if (location === "skalad") {
        const newStock = product.stock - product.quantity;
        return updateProduct({ id: product._id, stock: newStock }).unwrap();
      } else if (location === "dokon") {
        const storeProduct = storeProducts?.find(
          (p) => p.product_id?._id === product._id
        );
        return sellProductFromStore({
          product_id: storeProduct.product_id._id,
          quantity: product.quantity,
        }).unwrap();
      }
    });

    await Promise.all(updatePromises);
  }, [
    selectedProducts,
    location,
    storeProducts,
    updateProduct,
    sellProductFromStore,
  ]);

  // Asosiy sotish funksiyasi - optimallashtirilgan
  const handleSellProducts = useCallback(async () => {
    if (isProcessing) {
      message.warning("Iltimos, jarayon tugashini kuting...");
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Validatsiya
      await validateProductStock();

      // 2. Sotuv ma'lumotlarini saqlash
      if (paymentMethod === "qarz") {
        await processDebtSale();
      } else {
        await processRegularSale();
      }

      // 3. Omborni yangilash
      await updateInventory();

      // 4. Muvaffaqiyatli tugallash
      setChekModal(true);
      message.success("Mahsulotlar muvaffaqiyatli sotildi!");
      setIsModalVisible(false);
    } catch (error) {
      console.error("Error:", error);

      if (!navigator.onLine) {
        message.error("Internet aloqasi yo'q! Iltimos, internetni tekshiring.");
      } else if (error.message) {
        message.error(error.message);
      } else if (
        error.status === "FETCH_ERROR" ||
        error.originalStatus === "FETCH_ERROR"
      ) {
        message.error("Serverga ulanishda xatolik!");
      } else if (error.status >= 500) {
        message.error("Server xatoligi!");
      } else {
        message.error(`Xatolik: ${error.data?.message || "Noma'lum xatolik"}`);
      }

      // Xatolik bo'lsa ma'lumotlarni refresh qilish
      productRefetch();
      storeRefetch();
    } finally {
      setIsProcessing(false);
    }
  }, [
    isProcessing,
    validateProductStock,
    paymentMethod,
    processDebtSale,
    processRegularSale,
    updateInventory,
    productRefetch,
    storeRefetch,
  ]);

  // Umumiy summani hisoblash - useMemo bilan
  const totalAmount = useMemo(() => {
    return selectedProducts.reduce((acc, product) => {
      return acc + product.sell_price * product.quantity;
    }, 0);
  }, [selectedProducts]);

  // Nasiya yaratish - optimallashtirilgan
  const handleCreateNasiya = useCallback(
    async (e) => {
      e.preventDefault();
      const name = e.target.name.value;
      const nasiyaLocation = e.target.location.value;

      if (!name) {
        message.error("Ismni to'ldiring!");
        return;
      }
      if (!nasiyaLocation) {
        message.error("Joylashuvni to'ldiring!");
        return;
      }

      try {
        for (const product of selectedProducts) {
          if (nasiyaLocation === "skalad") {
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
              location: nasiyaLocation,
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
              location: nasiyaLocation,
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
        message.error("Xatolik yuz berdi!");
      }
    },
    [
      selectedProducts,
      storeProducts,
      createNasiya,
      storeRefetch,
      productRefetch,
    ]
  );

  return (
    <div className="kassa-container">
      <Modal
        open={chekModal}
        style={{ display: "flex", justifyContent: "center" }}
        onCancel={() => setChekModal(false)}
        footer={[
          <Button key="print" type="primary" onClick={handlePrint}>
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
        <form className="modal_form" onSubmit={handleCreateNasiya}>
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
        title=""
        bordered={false}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          flexDirection: "column-reverse",
          alignItems: "stretch",
          backgroundColor: "#0F4C81",
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
              disabled={isProcessing}
              loading={isProcessing}
            >
              {isProcessing ? "Kutilmoqda..." : "Sotish"}
            </Button>
          </div>
        )}
        <Modal
          title="To'lov usulini tanlang"
          visible={isModalVisible}
          onOk={handleSellProducts}
          onCancel={handleCancel}
          confirmLoading={isProcessing}
          okButtonProps={{ disabled: isProcessing }}
          cancelButtonProps={{ disabled: isProcessing }}
        >
          <Form layout="vertical">
            <Form.Item label="To'lov usuli">
              <Select
                value={paymentMethod}
                onChange={(value) => setPaymentMethod(value)}
                style={{ width: "100%" }}
                disabled={isProcessing}
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
                    disabled={isProcessing}
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
                        disabled={isProcessing}
                      />
                    </Form.Item>
                    <Form.Item label="Telefon raqami">
                      <AntdInput
                        value={debtorPhone}
                        onChange={(e) => setDebtorPhone(e.target.value)}
                        disabled={isProcessing}
                      />
                    </Form.Item>
                  </>
                )}

                <Form.Item label="Qarz muddatini kiriting">
                  <input
                    type="date"
                    value={debtDueDate}
                    onChange={(e) => setDebtDueDate(e.target.value)}
                    disabled={isProcessing}
                  />
                </Form.Item>
              </>
            )}

            <Form.Item label="Joylashuv">
              <Select
                value={location}
                onChange={(value) => setLocation(value)}
                style={{ width: "100%" }}
                disabled={isProcessing}
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
