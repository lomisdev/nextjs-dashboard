'use server'
import {z} from 'zod';
import postgres from 'postgres';
import {revalidatePath} from "next/cache";
import {redirect} from 'next/navigation'

export interface State {
    errors?: {
        customerId?: string[],
        amount?: string[],
        status?: string[],
    };
    message?: string | null;
    values?: { customerId?: string, amount?: string, status?: string };
}

const sql = postgres(process.env.POSTGRES_URL!, {ssl: 'require'});
const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer.'
    }),
    amount: z.coerce.number().gt(0, {message: 'Please enter an amount greater than $0.'}),
    status: z.enum(['pending', 'paid'], {invalid_type_error: 'Please select an invoice status.'}),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({id: true, date: true})

export async function createInvoice(prevState: State, formData: FormData) {
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    const values = {
        customerId: String(formData.get('customerId')) ?? '',
        amount: String(formData.get('amount')) ?? '',
        status: String(formData.get('status')) ?? '',
    }

    // If form validation fails return errors early. Otherwise continue
    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing fields. Failed to create invoice',
            values,
        }
    }

    // Prepare the data for insertion to the database
    const {customerId, amount, status} = validatedFields.data;

    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    try {
        await sql`
            INSERT INTO invoices(customer_id, amount, status, date)
            VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
    } catch (e) {
        console.log(e);
        return {
            message: 'Database error: Failed to Create Invoice'
        }
    }
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

const UpdateInvoice = FormSchema.omit({id: true, date: true});

export async function updateInvoice(id: string, prevState: State, formData: FormData) {
    const validatedFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    })

    const values = {
        customerId: String(formData.get('customerId') ?? ''),
        amount: String(formData.get('amount') ?? ''),
        status: String(formData.get('status') ?? ''),
    }
    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing fields. Failed to update invoice',
            values,
        }
    }

    const {customerId, amount, status} = validatedFields.data;
    const amountInCents = amount * 100;

    try {
        await sql`
            UPDATE invoices
            SET customer_id =${customerId},
                amount=${amountInCents},
                status=${status}
            WHERE id = ${id}
        `;
    } catch (e) {
        console.log(e);
        // throw new Error('Database error: Failed to Update Invoice')
        return {
            message: 'Database error: Failed to Update Invoice',
            values,
        }
    }
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
    // throw new Error('Failed to Delete Invoice');
    await sql`
        DELETE
        FROM invoices
        WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');
}