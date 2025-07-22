import { apiSlice } from "./api.service";

export const saleApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // 🟢 Sotuvni yaratish
    recordSale: builder.mutation({
      query: (sale) => ({
        url: "/sales",
        method: "POST",
        body: sale,
      }),
      invalidatesTags: ["Sales", "Debtor"],
    }),

    // 🟢 Sotuvlar tarixini olish
    getSalesHistory: builder.query({
      query: () => ({
        url: "/sales",
        method: "GET",
      }),
      providesTags: ["Sales", "Debtor"],
    }),

    // 🟢 Yillik statistika (grafiklar uchun)
    getSalesStats: builder.query({
      query: () => ({
        url: "/stat/year",
        method: "GET",
      }),
      providesTags: ["Sales", "Debtor"],
    }),

    // 🆕 Sotuvni o‘chirish (ID bo‘yicha)
    deleteSale: builder.mutation({
      query: (id) => ({
        url: `/sales/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Sales", "Debtor"],
    }),
  }),
});

export const {
  useRecordSaleMutation,
  useGetSalesHistoryQuery,
  useGetSalesStatsQuery,
  useDeleteSaleMutation, // 🆕 Export qilinadi
} = saleApi;
