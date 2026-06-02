import { useTable, EditButton, DeleteButton, useForm } from "@refinedev/antd"
import { Table, Form, Input, InputNumber, Switch, Space, Select, Card, Typography, Divider, Button } from "antd"
import { PlusOutlined, MinusCircleOutlined } from "@ant-design/icons"
import { List, Create, Edit } from "@refinedev/antd"

const { TextArea } = Input
const { Title, Text } = Typography

const TEMPLATES = [
  { value: "two_column", label: "Two Column (Text + Image)" },
  { value: "three_column", label: "Three Column Cards" },
  { value: "grid", label: "Image Grid" },
  { value: "full_banner", label: "Full Width Banner" },
  { value: "text_block", label: "Centered Text Block" },
]

const PAGE_OPTIONS = [
  { value: "homepage", label: "Homepage" },
  { value: "about", label: "About" },
  { value: "contact", label: "Contact" },
]

export const CustomSectionList = () => {
  const { tableProps } = useTable({
    resource: "cms_custom_sections",
    sorters: { initial: [{ field: "sort_order", order: "asc" }] },
  })

  return (
    <List>
      <Table {...tableProps} rowKey="id" size="small">
        <Table.Column dataIndex="sort_order" title="Order" width={70} />
        <Table.Column dataIndex="template" title="Template" render={(v: string) => TEMPLATES.find((t) => t.value === v)?.label || v} />
        <Table.Column dataIndex="title" title="Title" />
        <Table.Column dataIndex="page_slug" title="Page" width={100} />
        <Table.Column dataIndex="is_active" title="Active" render={(v: boolean) => (v ? "✓" : "—")} width={70} />
        <Table.Column
          title=""
          render={(_: any, record: any) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
              <DeleteButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
          width={90}
        />
      </Table>
    </List>
  )
}

const SectionForm = () => {
  const form = Form.useFormInstance()
  const template = Form.useWatch("template", form)

  return (
    <>
      <Card size="small" title="Section Settings" style={{ marginBottom: 16 }}>
        <Form.Item label="Page" name="page_slug" rules={[{ required: true }]} initialValue="homepage">
          <Select options={PAGE_OPTIONS} />
        </Form.Item>
        <Form.Item label="Template" name="template" rules={[{ required: true }]} initialValue="two_column">
          <Select options={TEMPLATES} />
        </Form.Item>
        <Form.Item label="Sort Order" name="sort_order" initialValue={0}>
          <InputNumber />
        </Form.Item>
        <Form.Item label="Active" name="is_active" valuePropName="checked" initialValue={true}>
          <Switch />
        </Form.Item>
      </Card>

      <Card size="small" title="Content" style={{ marginBottom: 16 }}>
        <Form.Item label="Title" name="title">
          <Input />
        </Form.Item>
        <Form.Item label="Subtitle" name="subtitle">
          <Input />
        </Form.Item>
        <Form.Item label="Description" name="description">
          <TextArea rows={3} />
        </Form.Item>
        <Form.Item label="CTA Label" name="cta_label">
          <Input />
        </Form.Item>
        <Form.Item label="CTA Link" name="cta_href">
          <Input />
        </Form.Item>
      </Card>

      <Card size="small" title="Appearance" style={{ marginBottom: 16 }}>
        <Form.Item label="Background Color" name="background_color" initialValue="#ffffff">
          <Input type="color" style={{ width: 80, padding: 2, height: 36 }} />
        </Form.Item>
        <Form.Item label="Text Color" name="text_color" initialValue="#1a1a1a">
          <Input type="color" style={{ width: 80, padding: 2, height: 36 }} />
        </Form.Item>
        <Form.Item label="Main Image URL" name="image_url">
          <Input placeholder="/images/..." />
        </Form.Item>
        {template === "two_column" && (
          <Form.Item label="Image Position" name="image_position" initialValue="right">
            <Select options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }]} />
          </Form.Item>
        )}
        <Form.Item label="Rounded Corners" name="rounded" valuePropName="checked" initialValue={true}>
          <Switch />
        </Form.Item>
        <Form.Item label="Full Width" name="full_width" valuePropName="checked" initialValue={false}>
          <Switch />
        </Form.Item>
      </Card>

      {/* Items — for multi-column/grid templates */}
      {(template === "three_column" || template === "grid") && (
        <Card size="small" title="Items (Columns / Grid Cells)">
          <Form.List name="items" initialValue={[]}>
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name }) => (
                  <Card
                    key={key}
                    size="small"
                    style={{ marginBottom: 12 }}
                    extra={<MinusCircleOutlined onClick={() => remove(name)} style={{ color: "#ff4d4f" }} />}
                  >
                    <Form.Item label="Title" name={[name, "title"]}>
                      <Input />
                    </Form.Item>
                    <Form.Item label="Text" name={[name, "text"]}>
                      <TextArea rows={2} />
                    </Form.Item>
                    <Form.Item label="Image URL" name={[name, "image_url"]}>
                      <Input />
                    </Form.Item>
                    <Form.Item label="CTA Label" name={[name, "cta_label"]}>
                      <Input />
                    </Form.Item>
                    <Form.Item label="CTA Link" name={[name, "cta_href"]}>
                      <Input />
                    </Form.Item>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  Add Item
                </Button>
              </>
            )}
          </Form.List>
        </Card>
      )}
    </>
  )
}

export const CustomSectionCreate = () => {
  const { formProps, saveButtonProps } = useForm()
  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <SectionForm />
      </Form>
    </Create>
  )
}

export const CustomSectionEdit = () => {
  const { formProps, saveButtonProps } = useForm()
  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <SectionForm />
      </Form>
    </Edit>
  )
}
