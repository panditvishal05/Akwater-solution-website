const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail', // You can change this to your preferred email service
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com', // Replace with your email
        pass: process.env.EMAIL_PASS || 'your-app-password' // Replace with your app password
    }
});

// Email template
const createEmailTemplate = (data) => {
    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(45deg, #0066cc, #00bcd4); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">AK Water Solutions</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">New Contact Form Submission</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                <h2 style="color: #0066cc; margin-bottom: 20px;">Contact Details</h2>
                
                <div style="margin-bottom: 15px;">
                    <strong style="color: #333;">Name:</strong>
                    <span style="margin-left: 10px; color: #666;">${data.name}</span>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <strong style="color: #333;">Email:</strong>
                    <span style="margin-left: 10px; color: #666;">${data.email}</span>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <strong style="color: #333;">Phone:</strong>
                    <span style="margin-left: 10px; color: #666;">${data.phone}</span>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <strong style="color: #333;">Service Required:</strong>
                    <span style="margin-left: 10px; color: #666;">${data.service}</span>
                </div>
                
                ${data.message ? `
                <div style="margin-bottom: 15px;">
                    <strong style="color: #333;">Message:</strong>
                    <div style="margin-top: 10px; padding: 15px; background-color: #f8f9fa; border-radius: 5px; color: #666; line-height: 1.6;">
                        ${data.message}
                    </div>
                </div>
                ` : ''}
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 14px;">
                    <p>This message was sent from the AK Water Solutions website contact form.</p>
                    <p>Please respond to the customer as soon as possible.</p>
                </div>
            </div>
        </div>
    `;
};

// Routes

// Serve the main website
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Contact form submission
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, phone, service, message } = req.body;
        
        // Validate required fields
        if (!name || !email || !phone || !service) {
            return res.status(400).json({
                success: false,
                message: 'Please fill in all required fields'
            });
        }
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
            });
        }
        
        // Phone validation
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid phone number'
            });
        }
        
        // Save contact data to file (you can replace this with database storage)
        const contactData = {
            timestamp: new Date().toISOString(),
            name,
            email,
            phone,
            service,
            message: message || '',
            ip: req.ip || req.connection.remoteAddress
        };
        
        // Append to contacts file
        const contactsFile = path.join(__dirname, 'contacts.json');
        let contacts = [];
        
        try {
            if (fs.existsSync(contactsFile)) {
                const data = fs.readFileSync(contactsFile, 'utf8');
                contacts = JSON.parse(data);
            }
        } catch (error) {
            console.error('Error reading contacts file:', error);
        }
        
        contacts.push(contactData);
        
        try {
            fs.writeFileSync(contactsFile, JSON.stringify(contacts, null, 2));
        } catch (error) {
            console.error('Error writing contacts file:', error);
        }
        
        // Send email notification
        const mailOptions = {
            from: process.env.EMAIL_USER || 'your-email@gmail.com',
            to: process.env.ADMIN_EMAIL || 'aviy855@gmail.com', // Correct admin email
            subject: `New Contact Form Submission - ${service}`,
            html: createEmailTemplate(contactData)
        };
        
        // Send email (only if email is configured)
        let emailSent = false;
        let emailErrorMsg = '';
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            try {
                await transporter.sendMail(mailOptions);
                console.log('Email sent successfully');
                emailSent = true;
            } catch (emailError) {
                console.error('Error sending email:', emailError);
                emailErrorMsg = emailError.message || String(emailError);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to send email notification. Please check your email configuration.',
                    emailSent,
                    emailErrorMsg
                });
            }
        } else {
            emailErrorMsg = 'EMAIL_USER or EMAIL_PASS not set in environment.';
            console.error(emailErrorMsg);
            return res.status(500).json({
                success: false,
                message: 'Email configuration missing. Please set EMAIL_USER and EMAIL_PASS.',
                emailSent,
                emailErrorMsg
            });
        }

        res.json({
            success: true,
            message: 'Thank you for your message! We will get back to you soon.',
            emailSent,
            emailErrorMsg
        });
        
    } catch (error) {
        console.error('Error processing contact form:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while processing your request. Please try again later.'
        });
    }
});

// Get all contacts (for admin purposes)
app.get('/api/contacts', (req, res) => {
    try {
        const contactsFile = path.join(__dirname, 'contacts.json');
        
        if (!fs.existsSync(contactsFile)) {
            return res.json([]);
        }
        
        const data = fs.readFileSync(contactsFile, 'utf8');
        const contacts = JSON.parse(data);
        
        res.json(contacts);
    } catch (error) {
        console.error('Error reading contacts:', error);
        res.status(500).json({
            success: false,
            message: 'Error reading contacts data'
        });
    }
});

// Get services list
app.get('/api/services', (req, res) => {
    const services = [
        {
            id: 1,
            name: 'Regular Maintenance & AMC',
            description: 'Annual maintenance contracts with regular servicing',
            icon: 'fas fa-tools',
            price: 'Starting from ₹2,000/year'
        },
        {
            id: 2,
            name: 'Filter Replacement',
            description: 'Genuine filter replacement with quality assurance',
            icon: 'fas fa-filter',
            price: 'Starting from ₹500'
        },
        {
            id: 3,
            name: 'Emergency Repairs',
            description: '24/7 emergency repair services at your doorstep',
            icon: 'fas fa-wrench',
            price: 'Starting from ₹800'
        },
        {
            id: 4,
            name: 'Installation & Relocation',
            description: 'Professional installation and relocation services',
            icon: 'fas fa-home',
            price: 'Starting from ₹1,500'
        }
    ];
    
    res.json(services);
});

// Get products list
app.get('/api/products', (req, res) => {
    const products = [
        {
            id: 1,
            name: 'Domestic RO Purifiers',
            description: 'Advanced RO technology for home use with 7-stage purification',
            price: '₹8,000 - ₹25,000',
            image: 'https://images.unsplash.com/photo-1581578731548-c6a0c3f2f6c5?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
            category: 'domestic'
        },
        {
            id: 2,
            name: 'Commercial Purifiers',
            description: 'Heavy-duty purifiers for offices and commercial spaces',
            price: '₹15,000 - ₹50,000',
            image: 'https://images.unsplash.com/photo-1581578731548-c6a0c3f2f6c5?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
            category: 'commercial'
        },
        {
            id: 3,
            name: 'UV + RO Systems',
            description: 'Combined UV and RO technology for maximum purification',
            price: '₹12,000 - ₹35,000',
            image: 'https://images.unsplash.com/photo-1581578731548-c6a0c3f2f6c5?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
            category: 'uv-ro'
        },
        {
            id: 4,
            name: 'Alkaline Water Purifiers',
            description: 'pH balanced water with added health benefits',
            price: '₹10,000 - ₹30,000',
            image: 'https://images.unsplash.com/photo-1581578731548-c6a0c3f2f6c5?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
            category: 'alkaline'
        },
        {
            id: 5,
            name: 'UV Water Purifiers',
            description: 'Ultraviolet purification for bacteria-free water',
            price: '₹6,000 - ₹18,000',
            image: 'https://images.unsplash.com/photo-1581578731548-c6a0c3f2f6c5?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
            category: 'uv'
        },
        {
            id: 6,
            name: 'Smart Water Purifiers',
            description: 'IoT-enabled purifiers with mobile app control',
            price: '₹20,000 - ₹45,000',
            image: 'https://images.unsplash.com/photo-1581578731548-c6a0c3f2f6c5?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
            category: 'smart'
        }
    ];
    
    res.json(products);
});

// Get testimonials
app.get('/api/testimonials', (req, res) => {
    const testimonials = [
        {
            id: 1,
            name: 'Ramesh Kumar',
            location: 'Delhi',
            rating: 5,
            comment: 'Excellent service! My purifier was fixed in just 1 hour. The technician was very professional and explained everything clearly.',
            image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80'
        },
        {
            id: 2,
            name: 'Priya Sharma',
            location: 'Mumbai',
            rating: 5,
            comment: 'Affordable and genuine products. Highly recommend! The installation was done perfectly and the after-sales service is excellent.',
            image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80'
        },
        {
            id: 3,
            name: 'Amit Patel',
            location: 'Bangalore',
            rating: 5,
            comment: 'Great experience! The team is very knowledgeable and the pricing is transparent. My family is happy with the water quality.',
            image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80'
        }
    ];
    
    res.json(testimonials);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 AK Water Solutions server is running on port ${PORT}`);
    console.log(`📧 Email notifications: ${process.env.EMAIL_USER ? 'Enabled' : 'Disabled (configure EMAIL_USER and EMAIL_PASS)'}`);
    console.log(`🌐 Website: http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});
