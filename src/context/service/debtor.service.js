import { apiSlice } from "./api.service";

export const debtorApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // 🟢 Qarzdor yaratish
    createDebtor: builder.mutation({
      query: (debtor) => ({
        url: "/debtors",
        method: "POST",
        body: debtor,
      }),
      invalidatesTags: ["Debtor", "Sales"],
    }),

    // 🟢 Qarzdor mahsulotni qaytarish
    returnProductDebtor: builder.mutation({
      query: (body) => ({
        url: "/debtors/return",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Debtor", "Sales"],
    }),

    // 🟢 Barcha qarzdorlarni olish
    getDebtors: builder.query({
      query: () => ({
        url: "/debtors",
        method: "GET",
      }),
      providesTags: ["Debtor", "Sales"],
    }),

    // 🟢 Qarzdor to‘lovini yangilash (qisman yoki to‘liq)
    updateDebtor: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/debtors/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Debtor", "Sales"],
    }),

    // debtor.service.js (yoki redux query)
    editDebtor: builder.mutation({
      query: ({ id, body }) => ({
        url: `/debtor/${id}`, // ✅ bu to‘g‘ri
        method: "PUT",
        body,
      }),
    }),

    // 🟢 Valyuta bilan to‘lov qilish
    createPayment: builder.mutation({
      query: (body) => ({
        url: `/debtor/pay`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Debtor", "Sales"],
    }),

    // 🟢 Qarzdorni o‘chirish
    deleteDebtor: builder.mutation({
      query: (id) => ({
        url: `/debtors/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Debtor", "Sales"],
    }),
  }),
});

// ⬇️ Export qilinadigan hooklar
export const {
  useCreateDebtorMutation,
  useGetDebtorsQuery,
  useUpdateDebtorMutation,
  useDeleteDebtorMutation,
  useReturnProductDebtorMutation,
  useEditDebtorMutation,
  useCreatePaymentMutation,
} = debtorApi;
