import prisma from '../config/prisma.js';

export const getAllLabs = async (req, res, next) => {
    try {
        const labs = await prisma.lab.findMany({
            include: { services: true }
        });
        res.json(labs);
    } catch (err) {
        next(err);
    }
};

export const createLab = async (req, res, next) => {
    try {
        const { name, address, phone, rating, image, services } = req.body;
        const newLab = await prisma.lab.create({
            data: {
                name,
                address,
                phone,
                rating: parseFloat(rating) || 0.0,
                image,
                services: {
                    create: services?.map(s => ({
                        name: s.name,
                        price: parseFloat(s.price)
                    })) || []
                }
            },
            include: { services: true }
        });
        res.status(201).json(newLab);
    } catch (err) {
        next(err);
    }
};

export const updateLab = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, address, phone, rating, image, services } = req.body;
        
        const updatedLab = await prisma.lab.update({
            where: { id: parseInt(id) },
            data: {
                name,
                address,
                phone,
                rating: rating !== undefined ? parseFloat(rating) : undefined,
                image
            }
        });

        if (services) {
            await prisma.labService.deleteMany({
                where: { labId: parseInt(id) }
            });
            if (services.length > 0) {
                await prisma.labService.createMany({
                    data: services.map(s => ({
                        name: s.name,
                        price: parseFloat(s.price),
                        labId: parseInt(id)
                    }))
                });
            }
        }

        const finalLab = await prisma.lab.findUnique({
            where: { id: parseInt(id) },
            include: { services: true }
        });

        res.json(finalLab);
    } catch (err) {
        next(err);
    }
};

export const deleteLab = async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma.lab.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: 'Lab deleted successfully' });
    } catch (err) {
        next(err);
    }
};
