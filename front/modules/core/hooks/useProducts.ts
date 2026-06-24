import { useState, useCallback } from 'react';
import { ProductCategory, ProductUnit, VariantTemplate } from '../../core/types/types';
import { productService } from '../../products/services/productService';

export const useProducts = () => {
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [units, setUnits] = useState<ProductUnit[]>([]);
    const [templates, setTemplates] = useState<VariantTemplate[]>([]);
    const [loading, setLoading] = useState(false);

    const getCategories = useCallback(async () => {
        setLoading(true);
        try {
            const data = await productService.getCategories();
            setCategories(data);
        } finally {
            setLoading(false);
        }
    }, []);

    const getUnits = useCallback(async () => {
        setLoading(true);
        try {
            const data = await productService.getUnits();
            setUnits(data);
        } finally {
            setLoading(false);
        }
    }, []);

    const getVariantTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const data = await productService.getVariantTemplates();
            setTemplates(data || []);
        } finally {
            setLoading(false);
        }
    }, []);

    const addCategory = async (category: Omit<ProductCategory, 'id'>) => {
        const newCategory = await productService.addCategory(category);
        if (newCategory) await getCategories();
        return newCategory;
    };

    const updateCategory = async (id: string, updates: Partial<ProductCategory>) => {
        const success = await productService.updateCategory(id, updates);
        if (success) await getCategories();
        return success;
    };

    const deleteCategory = async (id: string) => {
        const success = await productService.deleteCategory(id);
        if (success) await getCategories();
        return success;
    };

    const addUnit = async (unit: Omit<ProductUnit, 'id'>) => {
        const newUnit = await productService.addUnit(unit);
        if (newUnit) await getUnits();
        return newUnit;
    };

    const updateUnit = async (id: string, updates: Partial<ProductUnit>) => {
        const success = await productService.updateUnit(id, updates);
        if (success) await getUnits();
        return success;
    };

    const deleteUnit = async (id: string) => {
        const success = await productService.deleteUnit(id);
        if (success) await getUnits();
        return success;
    };

    const addVariantTemplate = async (template: Omit<VariantTemplate, 'id'>) => {
        const newTemplate = await productService.addVariantTemplate(template);
        if (newTemplate) await getVariantTemplates();
        return newTemplate;
    };

    const updateVariantTemplate = async (id: string, updates: Partial<VariantTemplate>) => {
        const success = await productService.updateVariantTemplate(id, updates);
        if (success) await getVariantTemplates();
        return success;
    };

    const deleteVariantTemplate = async (id: string) => {
        const success = await productService.deleteVariantTemplate(id);
        if (success) await getVariantTemplates();
        return success;
    };

    return {
        categories,
        units,
        templates,
        getCategories,
        getUnits,
        getVariantTemplates,
        addCategory,
        updateCategory,
        deleteCategory,
        addUnit,
        updateUnit,
        deleteUnit,
        addVariantTemplate,
        updateVariantTemplate,
        deleteVariantTemplate,
        loading
    };
};

