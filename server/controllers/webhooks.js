import { Webhook } from "svix";
import User from "../models/User.js";

// Middleware to store raw request body
export const rawBodyMiddleware = (req, res, next) => {
  req.rawBody = '';
  req.on('data', chunk => req.rawBody += chunk);
  req.on('end', next);
};

export const clerkWebhooks = async (req, res) => {
  try {
    const whook = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
    const svixHeaders = {
      "svix-id": req.headers["svix-id"],
      "svix-timestamp": req.headers["svix-timestamp"],
      "svix-signature": req.headers["svix-signature"],
    };

    await whook.verify(req.rawBody, svixHeaders);
    
    const { data, type } = req.body;


    if (!data?.id) {
      return res.status(400).json({ success: false, message: "Invalid user data: Missing ID" });
    }

    switch (type) {
      case 'user.created': {

        const primaryEmailObj = data.email_addresses.find(
          email => email.id === data.primary_email_id
        );
        if (!primaryEmailObj) {
          throw new Error("No primary email found");
        }

        const userData = {
          _id: data.id,
          email: primaryEmailObj.email_addresses,
          name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
          imageUrl: data.image_url,
        };
        
        await User.create(userData);
        return res.status(200).json({ success: true });
      }

      case 'user.updated': {
        const primaryEmailObj = data.email_addresses.find(
          email => email.id === data.primary_email_id
        );
        const userData = {
          email: primaryEmailObj?.email_address,
          name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
          imageUrl: data.image_url,
        };
        
        await User.findByIdAndUpdate(data.id, userData, { new: true });
        return res.status(200).json({ success: true });
      }

      case 'user.deleted': {
        await User.findByIdAndDelete(data.id);
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(200).json({ success: true });
    }
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};