const { body, validationResult } = require('express-validator');

class ValidationUtils {
    /**
     * Middleware para validar resultados de validação
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     * @param {Function} next - Next middleware function
     */
    static handleValidationErrors(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Dados inválidos',
                errors: errors.array()
            });
        }
        next();
    }
    
    /**
     * Validações para registro de usuário
     */
    static validateUserRegistration() {
        return [
            body('name')
                .trim()
                .isLength({ min: 2, max: 100 })
                .withMessage('Nome deve ter entre 2 e 100 caracteres')
                .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
                .withMessage('Nome deve conter apenas letras e espaços'),
            
            body('email')
                .isEmail()
                .withMessage('Email deve ter um formato válido')
                .normalizeEmail()
                .isLength({ max: 255 })
                .withMessage('Email deve ter no máximo 255 caracteres'),
            
            body('password')
                .isLength({ min: 6, max: 128 })
                .withMessage('Senha deve ter entre 6 e 128 caracteres')
                .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
                .withMessage('Senha deve conter ao menos uma letra minúscula, uma maiúscula e um número'),
            
            body('hardware_id')
                .trim()
                .isLength({ min: 10, max: 255 })
                .withMessage('Hardware ID deve ter entre 10 e 255 caracteres')
                .matches(/^[a-fA-F0-9]+$/)
                .withMessage('Hardware ID deve conter apenas caracteres hexadecimais')
        ];
    }
    
    /**
     * Validações para login
     */
    static validateLogin() {
        return [
            body('email')
                .isEmail()
                .withMessage('Email deve ter um formato válido')
                .normalizeEmail(),
            
            body('password')
                .notEmpty()
                .withMessage('Senha é obrigatória'),
            
            body('hardware_id')
                .trim()
                .isLength({ min: 10, max: 255 })
                .withMessage('Hardware ID deve ter entre 10 e 255 caracteres')
                .matches(/^[a-fA-F0-9]+$/)
                .withMessage('Hardware ID deve conter apenas caracteres hexadecimais')
        ];
    }
    
    /**
     * Validações para criação de node
     */
    static validateNodeCreation() {
        return [
            body('name')
                .trim()
                .isLength({ min: 2, max: 255 })
                .withMessage('Nome deve ter entre 2 e 255 caracteres')
                .matches(/^[a-zA-ZÀ-ÿ0-9\s\-_]+$/)
                .withMessage('Nome deve conter apenas letras, números, espaços, hífens e underscores'),
            
            body('description')
                .trim()
                .isLength({ min: 10, max: 1000 })
                .withMessage('Descrição deve ter entre 10 e 1000 caracteres'),
            
            body('reward')
                .isFloat({ min: 0.01, max: 999999.99 })
                .withMessage('Recompensa deve ser um número entre 0.01 e 999999.99'),
            
            body('max_users')
                .isInt({ min: 1, max: 1000 })
                .withMessage('Máximo de usuários deve ser um número inteiro entre 1 e 1000')
        ];
    }
    
    /**
     * Validações para atualização de node
     */
    static validateNodeUpdate() {
        return [
            body('name')
                .optional()
                .trim()
                .isLength({ min: 2, max: 255 })
                .withMessage('Nome deve ter entre 2 e 255 caracteres')
                .matches(/^[a-zA-ZÀ-ÿ0-9\s\-_]+$/)
                .withMessage('Nome deve conter apenas letras, números, espaços, hífens e underscores'),
            
            body('description')
                .optional()
                .trim()
                .isLength({ min: 10, max: 1000 })
                .withMessage('Descrição deve ter entre 10 e 1000 caracteres'),
            
            body('reward')
                .optional()
                .isFloat({ min: 0.01, max: 999999.99 })
                .withMessage('Recompensa deve ser um número entre 0.01 e 999999.99'),
            
            body('max_users')
                .optional()
                .isInt({ min: 1, max: 1000 })
                .withMessage('Máximo de usuários deve ser um número inteiro entre 1 e 1000'),
            
            body('status')
                .optional()
                .isIn(['available', 'claimed', 'completed', 'inactive'])
                .withMessage('Status deve ser: available, claimed, completed ou inactive')
        ];
    }
    
    /**
     * Validações para atualização de usuário
     */
    static validateUserUpdate() {
        return [
            body('name')
                .optional()
                .trim()
                .isLength({ min: 2, max: 100 })
                .withMessage('Nome deve ter entre 2 e 100 caracteres')
                .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
                .withMessage('Nome deve conter apenas letras e espaços'),
            
            body('email')
                .optional()
                .isEmail()
                .withMessage('Email deve ter um formato válido')
                .normalizeEmail()
                .isLength({ max: 255 })
                .withMessage('Email deve ter no máximo 255 caracteres'),
            
            body('user_type')
                .optional()
                .isIn(['user', 'admin'])
                .withMessage('Tipo de usuário deve ser: user ou admin')
        ];
    }
    
    /**
     * Validações para parâmetros de ID
     */
    static validateId() {
        return [
            body('id')
                .isInt({ min: 1 })
                .withMessage('ID deve ser um número inteiro positivo')
        ];
    }
    
    /**
     * Sanitiza string removendo caracteres perigosos
     * @param {string} str - String a ser sanitizada
     * @returns {string} String sanitizada
     */
    static sanitizeString(str) {
        if (typeof str !== 'string') return str;
        
        // Remove tags HTML/XML
        str = str.replace(/<[^>]*>/g, '');
        
        // Remove caracteres de controle
        str = str.replace(/[\x00-\x1F\x7F]/g, '');
        
        // Limita espaços em sequência
        str = str.replace(/\s+/g, ' ');
        
        return str.trim();
    }
    
    /**
     * Valida formato de Hardware ID
     * @param {string} hardwareId - Hardware ID a ser validado
     * @returns {boolean} True se válido, false caso contrário
     */
    static isValidHardwareId(hardwareId) {
        if (!hardwareId || typeof hardwareId !== 'string') {
            return false;
        }
        
        // Deve ter entre 10 e 255 caracteres
        if (hardwareId.length < 10 || hardwareId.length > 255) {
            return false;
        }
        
        // Deve conter apenas caracteres hexadecimais
        return /^[a-fA-F0-9]+$/.test(hardwareId);
    }
    
    /**
     * Valida formato de email
     * @param {string} email - Email a ser validado
     * @returns {boolean} True se válido, false caso contrário
     */
    static isValidEmail(email) {
        if (!email || typeof email !== 'string') {
            return false;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email) && email.length <= 255;
    }
    
    /**
     * Valida força da senha
     * @param {string} password - Senha a ser validada
     * @returns {Object} Resultado da validação com score e sugestões
     */
    static validatePasswordStrength(password) {
        if (!password || typeof password !== 'string') {
            return {
                valid: false,
                score: 0,
                suggestions: ['Senha é obrigatória']
            };
        }
        
        const suggestions = [];
        let score = 0;
        
        // Comprimento
        if (password.length < 6) {
            suggestions.push('Senha deve ter pelo menos 6 caracteres');
        } else if (password.length >= 8) {
            score += 1;
        }
        
        // Letra minúscula
        if (!/[a-z]/.test(password)) {
            suggestions.push('Adicione pelo menos uma letra minúscula');
        } else {
            score += 1;
        }
        
        // Letra maiúscula
        if (!/[A-Z]/.test(password)) {
            suggestions.push('Adicione pelo menos uma letra maiúscula');
        } else {
            score += 1;
        }
        
        // Número
        if (!/\d/.test(password)) {
            suggestions.push('Adicione pelo menos um número');
        } else {
            score += 1;
        }
        
        // Caractere especial
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            suggestions.push('Considere adicionar um caractere especial');
        } else {
            score += 1;
        }
        
        return {
            valid: score >= 3 && password.length >= 6,
            score,
            suggestions
        };
    }
    
    /**
     * Escapa caracteres SQL para prevenir injeção
     * @param {string} str - String a ser escapada
     * @returns {string} String escapada
     */
    static escapeSql(str) {
        if (typeof str !== 'string') return str;
        return str.replace(/'/g, "''");
    }
}

module.exports = ValidationUtils;