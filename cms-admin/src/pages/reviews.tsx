import { Create, Edit, useForm } from "@refinedev/antd"
import { Form, Input, Switch, Rate, Select, Spin } from "antd"
import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"

type ProductOption = {
  id: string
  title: string
  thumbnail: string | null
}

function useProducts() {
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${import.meta.env.VITE_MEDUSA_BACKEND_URL || "http://localhost:9000"}/store/products?limit=100&fields=title,handle,thumbnail`, {
      headers: {
        "x-publishable-api-key": import.meta.env.VITE_MEDUSA_PUBLISHABLE_KEY || "",
      },
    })
      .then((r) => r.json())
      .then((data) => {
        setProducts(
          (data.products || []).map((p: any) => ({
            id: p.id,
            title: p.title,
            thumbnail: p.thumbnail,
          }))
        )
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { products, loading }
}

const ReviewForm = () => {
  const { products, loading: productsLoading } = useProducts()
  const form = Form.useFormInstance()

  const handleProductChange = (productId: string) => {
    const product = products.find((p) => p.id === productId)
    if (product) {
      form.setFieldsValue({
        product_name: product.title,
        product_image: product.thumbnail || "/images/fallback-no-image.png",
      })
    }
  }

  return (
    <>
      <Form.Item label="Customer Name" name="name" rules={[{ required: true }]}>
        <Input placeholder="e.g. Priya Sharma" />
      </Form.Item>
      <Form.Item
        label="Rating"
        name="rating"
        rules={[{ required: true }]}
        initialValue={5}
        extra="Half stars supported"
      >
        <Rate allowHalf />
      </Form.Item>
      <Form.Item label="Review Text" name="text" rules={[{ required: true }]}>
        <Input.TextArea rows={4} placeholder="Write the customer's review..." maxLength={500} showCount />
      </Form.Item>
      <Form.Item
        label="Product"
        name="product_id"
        rules={[{ required: true, message: "Please select a product" }]}
        extra="Product name and image are auto-filled from selection"
      >
        <Select
          showSearch
          placeholder="Search and select a product..."
          loading={productsLoading}
          options={products.map((p) => ({
            label: p.title,
            value: p.id,
          }))}
          filterOption={(input, option) =>
            (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
          }
          notFoundContent={productsLoading ? <Spin size="small" /> : "No products found"}
          onChange={handleProductChange}
        />
      </Form.Item>
      {/* Hidden — auto-filled from product selection */}
      <Form.Item name="product_name" hidden><Input /></Form.Item>
      <Form.Item name="product_image" hidden><Input /></Form.Item>
      <Form.Item label="Active" name="is_active" valuePropName="checked" initialValue={true}>
        <Switch />
      </Form.Item>
    </>
  )
}

export const ReviewCreate = () => {
  const navigate = useNavigate()
  const { formProps, saveButtonProps } = useForm({
    redirect: false,
    onMutationSuccess: () => navigate("/homepage?tab=reviews"),
  })
  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <ReviewForm />
      </Form>
    </Create>
  )
}

export const ReviewEdit = () => {
  const navigate = useNavigate()
  const { formProps, saveButtonProps } = useForm({
    redirect: false,
    onMutationSuccess: () => navigate("/homepage?tab=reviews"),
  })
  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <ReviewForm />
      </Form>
    </Edit>
  )
}
