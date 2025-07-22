import React, { useEffect, useState } from "react";
import { useGetBudgetQuery } from "../../context/service/budget.service";
import "./xisobot.css";
import { useGetAllProductsQuery } from "../../context/service/addproduct.service";
import { useGetDebtorsQuery } from "../../context/service/debtor.service";
import { useGetStoreProductsQuery } from "../../context/service/store.service";
import { useGetExpensesQuery } from "../../context/service/harajatlar.service";
import { useGetSalesHistoryQuery } from "../../context/service/sale.service";
import { useGetUsdRateQuery } from "../../context/service/usd.service";
import { DatePicker } from "antd";

const { RangePicker } = DatePicker;

export default function Xisobot() {
  const { data: budgetData } = useGetBudgetQuery();
  const { data: saleData } = useGetSalesHistoryQuery();
  const { data: skladData } = useGetAllProductsQuery();
  const { data: storeData } = useGetStoreProductsQuery();
  const { data: debtData, isLoading: debtLoading } = useGetDebtorsQuery();
  const { data: harajatData } = useGetExpensesQuery();
  const { data: usdRate } = useGetUsdRateQuery();

  const [selectedRange, setSelectedRange] = useState([]);
  const [umumiyDebt, setUmumiyDebt] = useState(0); // USD qarzdorlik
  const [umumiyDebtUzs, setUmumiyDebtUzs] = useState(0); // So'm qarzdorlik
  const [umumiySaleSum, setUmumiySaleSum] = useState(0); // So'mdagi sotuv summasi
  const [umumiySaleUsd, setUmumiySaleUsd] = useState(0); // USDdagi sotuv summasi
  const [umumiyFoydaSum, setUmumiyFoydaSum] = useState(0); // So'mdagi foyda
  const [umumiyFoydaUsd, setUmumiyFoydaUsd] = useState(0); // USDdagi foyda
  const [umumiyHarajat, setUmumiyHarajat] = useState(0);
  const [umumiyAstatka, setUmumiyAstatka] = useState(0);
  const [umumiyAstatkaUzs, setUmumiyAstatkaUzs] = useState(0); // So'm astatka

  const currentRate = usdRate?.rate || 12650; // Joriy kurs (birinchi koddagi kabi)

  const handleDateChange = (dates) => {
    if (!dates || dates.length === 0) {
      setSelectedRange([]);
      return;
    }
    setSelectedRange(dates);
  };

  // Valyutani aniqlash funksiyasi
  const isUsdCurrency = (currency) => {
    if (!currency) return false;
    const normalizedCurrency = currency.toString().toLowerCase();
    return ["usd", "dollar", "us dollar", "$"].includes(normalizedCurrency);
  };

  // Raqamlarni formatlash funksiyasi
  const formatNumber = (num) => {
    return Number(num || 0).toLocaleString("uz-UZ", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Birinchi koddagi calculateProfitLoss funksiyasi
  const calculateProfitLoss = (sale) => {
    if (sale.payment_method === "qarzdor_tolovi") return 0;

    if (!sale.sell_price || !sale.buy_price) return 0;

    const quantity = sale.quantity || 1;
    const sellPrice = sale.sell_price * quantity;
    let buyPrice = sale.buy_price * quantity;

    // Mahsulot asl valyutasini aniqlaymiz
    const productCurrency = sale.product_id?.currency || sale.currency;

    // Kursga qarab buy_price ni konvertatsiya qilamiz
    if (productCurrency === "usd" && sale.currency === "sum") {
      buyPrice *= currentRate;
    } else if (productCurrency === "sum" && sale.currency === "usd") {
      buyPrice /= currentRate;
    }

    return sellPrice - buyPrice;
  };

  useEffect(() => {
    if (!debtData || debtLoading) {
      setUmumiyDebt(0);
      setUmumiyDebtUzs(0);
      return;
    }

    const startDate = selectedRange[0] ? selectedRange[0].startOf("day") : null;
    const endDate = selectedRange[1] ? selectedRange[1].endOf("day") : null;

    // QARZDORLIKNI HISOBLASH
    let totalUsdDebt = 0;
    let totalSumDebt = 0;

    debtData.forEach((debtor) => {
      const itemDate = new Date(debtor.createdAt);

      // Sana filtrini tekshirish
      if (startDate && itemDate < startDate) return;
      if (endDate && itemDate > endDate) return;

      const debtAmount = Number(debtor.debt_amount || 0);
      const currency = debtor.currency || "usd";

      if (isUsdCurrency(currency)) {
        totalUsdDebt += debtAmount;
      } else {
        totalSumDebt += debtAmount;
      }
    });

    setUmumiyDebt(totalUsdDebt);
    setUmumiyDebtUzs(totalSumDebt);

    // SOTUV SUMMASINI HISOBLASH
    let totalSaleSum = 0;
    let totalSaleUsd = 0;

    if (saleData && Array.isArray(saleData)) {
      saleData.forEach((sale) => {
        const saleDate = new Date(sale.createdAt);

        // Sana filtrini tekshirish
        if (startDate && saleDate < startDate) return;
        if (endDate && saleDate > endDate) return;

        const saleAmount = Number(sale.total_price || 0);
        const currency = sale.currency || "sum";

        if (isUsdCurrency(currency)) {
          totalSaleUsd += saleAmount;
        } else {
          totalSaleSum += saleAmount;
        }
      });
    }

    setUmumiySaleSum(totalSaleSum);
    setUmumiySaleUsd(totalSaleUsd);

    // FOYDANI HISOBLASH - Birinchi koddagi kabi
    let totalProfitSum = 0;
    let totalProfitUsd = 0;

    if (saleData && Array.isArray(saleData)) {
      saleData.forEach((sale) => {
        const saleDate = new Date(sale.createdAt);

        // Sana filtrini tekshirish
        if (startDate && saleDate < startDate) return;
        if (endDate && saleDate > endDate) return;

        const profitLoss = calculateProfitLoss(sale);
        const currency = sale.currency || "sum";

        if (isUsdCurrency(currency)) {
          totalProfitUsd += profitLoss;
        } else {
          totalProfitSum += profitLoss;
        }
      });
    }

    // HARAJATNI HISOBLASH
    let totalExpenses = 0;
    if (harajatData && Array.isArray(harajatData)) {
      harajatData.forEach((expense) => {
        const expenseDate = new Date(expense.created_at);

        // Sana filtrini tekshirish
        if (startDate && expenseDate < startDate) return;
        if (endDate && expenseDate > endDate) return;

        const amount = Number(expense.payment_summ || 0);
        const currency = expense.currency || "sum";

        if (isUsdCurrency(currency)) {
          // USD harajatni so'mga aylantirish
          totalExpenses += amount * currentRate;
        } else {
          totalExpenses += amount;
        }
      });
    }

    setUmumiyHarajat(totalExpenses);

    // UMUMIY FOYDANI HISOBLASH (harajatni ayirish)
    const finalProfitSum = totalProfitSum - totalExpenses;
    setUmumiyFoydaSum(finalProfitSum);
    setUmumiyFoydaUsd(totalProfitUsd);

    // ASTATKA HISOBLASH
    let astatkaUsd = 0;
    let astatkaSum = 0;

    // Sklad astatka
    if (skladData && Array.isArray(skladData)) {
      skladData.forEach((item) => {
        const stock = Number(item.stock || 0);
        const purchasePrice = Number(item.purchase_price || 0);
        const currency = item.purchase_currency || item.sell_currency || "sum";

        const totalValue = stock * purchasePrice;

        if (isUsdCurrency(currency)) {
          astatkaUsd += totalValue;
        } else {
          astatkaSum += totalValue;
        }
      });
    }

    // Do'kon astatka
    if (storeData && Array.isArray(storeData)) {
      storeData.forEach((item) => {
        const quantity = Number(item.quantity || 0);
        const purchasePrice = Number(item.product_id?.purchase_price || 0);
        const currency =
          item.product_id?.purchase_currency ||
          item.product_id?.sell_currency ||
          "sum";

        const totalValue = quantity * purchasePrice;

        if (isUsdCurrency(currency)) {
          astatkaUsd += totalValue;
        } else {
          astatkaSum += totalValue;
        }
      });
    }

    setUmumiyAstatka(astatkaUsd);
    setUmumiyAstatkaUzs(astatkaSum);

    // Debug ma'lumotlari
    console.log("=== HISOBOT DEBUG ===");
    console.log("Qarzdorlik USD:", totalUsdDebt);
    console.log("Qarzdorlik So'm:", totalSumDebt);
    console.log("Sotuv USD:", totalSaleUsd);
    console.log("Sotuv So'm:", totalSaleSum);
    console.log("Foyda USD:", totalProfitUsd);
    console.log("Foyda So'm (harajat ayirilishidan oldin):", totalProfitSum);
    console.log("Foyda So'm (harajat ayirilgandan keyin):", finalProfitSum);
    console.log("Harajat So'm:", totalExpenses);
    console.log("Astatka USD:", astatkaUsd);
    console.log("Astatka So'm:", astatkaSum);
  }, [
    debtData,
    saleData,
    skladData,
    storeData,
    harajatData,
    selectedRange,
    usdRate,
    debtLoading,
    currentRate,
  ]);

  return (
    <div style={{ height: "calc(100vh - 200px)", paddingInline: "12px" }}>
      <div style={{ marginBottom: "20px" }}>
        <RangePicker
          onChange={handleDateChange}
          format="YYYY-MM-DD"
          style={{ width: "100%" }}
          placeholder={["Boshlanish sanasi", "Tugash sanasi"]}
        />
      </div>

      {debtLoading ? (
        <p>Ma'lumotlar yuklanmoqda...</p>
      ) : (
        <div className="hisobot_container">
          <div className="hisobot_card">
            <p style={{ color: "#000" }}>Umumiy sotuv summasi (So'm)</p>
            <b style={{ color: "#008000" }}>
              {formatNumber(umumiySaleSum)} UZS
            </b>
          </div>

          <div className="hisobot_card">
            <p style={{ color: "#000" }}>Umumiy sotuv summasi (USD)</p>
            <b style={{ color: "#008000" }}>{formatNumber(umumiySaleUsd)} $</b>
          </div>

          <div className="hisobot_card">
            <p style={{ color: "#000" }}>Umumiy foyda (So'm)</p>
            <b style={{ color: umumiyFoydaSum >= 0 ? "#008000" : "#ff0000" }}>
              0 UZS
            </b>
          </div>

          <div className="hisobot_card">
            <p style={{ color: "#000" }}>Umumiy foyda (USD)</p>
            <b style={{ color: umumiyFoydaUsd >= 0 ? "#008000" : "#ff0000" }}>
              {formatNumber(umumiyFoydaUsd)} $
            </b>
          </div>

          <div className="hisobot_card">
            <p style={{ color: "#000" }}>Umumiy qarzdorlik (USD)</p>
            <b style={{ color: "#ff6600" }}>{formatNumber(umumiyDebt)} $</b>
          </div>

          <div className="hisobot_card">
            <p style={{ color: "#000" }}>Umumiy harajat (So'm)</p>
            <b style={{ color: "#ff0000" }}>
              {formatNumber(umumiyHarajat)} UZS
            </b>
          </div>

          <div className="hisobot_card">
            <p style={{ color: "#000" }}>Astatka (USD)</p>
            <b style={{ color: "#0066cc" }}>
              {formatNumber(umumiyAstatkaUzs)} $
            </b>
          </div>
        </div>
      )}
    </div>
  );
}
